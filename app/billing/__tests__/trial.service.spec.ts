import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { TrialService } from '../trial.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BILLING_TRIAL_QUEUE } from '../billing.constants';

describe('TrialService', () => {
  let service: TrialService;
  const mockPrisma = {
    tenant: { update: jest.fn() },
    billingEvent: { create: jest.fn() },
  };
  const mockTrialQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TrialService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(BILLING_TRIAL_QUEUE), useValue: mockTrialQueue },
      ],
    }).compile();
    service = module.get(TrialService);
  });

  describe('startTrial', () => {
    it('sets plan_tier to growth and trial_ends_at 14 days from now', async () => {
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.billingEvent.create.mockResolvedValue({});
      mockTrialQueue.add.mockResolvedValue({});

      const before = Date.now();
      await service.startTrial('t1');
      const after = Date.now();

      const updateCall = mockPrisma.tenant.update.mock.calls[0][0];
      expect(updateCall.data.plan_tier).toBe('growth');
      const trialEnd: Date = updateCall.data.trial_ends_at;
      const expectedMs = 14 * 24 * 60 * 60 * 1000;
      expect(trialEnd.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
      expect(trialEnd.getTime()).toBeLessThanOrEqual(after + expectedMs);
    });

    it('writes trial_started billing event', async () => {
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.billingEvent.create.mockResolvedValue({});
      mockTrialQueue.add.mockResolvedValue({});

      await service.startTrial('t1');

      expect(mockPrisma.billingEvent.create).toHaveBeenCalledWith({
        data: { tenant_id: 't1', event_type: 'trial_started' },
      });
    });

    it('enqueues exactly 3 Bull jobs: d7, d12, trial-end', async () => {
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.billingEvent.create.mockResolvedValue({});
      mockTrialQueue.add.mockResolvedValue({});

      await service.startTrial('t1');

      expect(mockTrialQueue.add).toHaveBeenCalledTimes(3);
      const jobNames = mockTrialQueue.add.mock.calls.map((c: unknown[]) => c[0]);
      expect(jobNames).toContain('trial-reminder-d7');
      expect(jobNames).toContain('trial-reminder-d12');
      expect(jobNames).toContain('trial-end');
    });

    it('enqueues d7 job with 7-day delay', async () => {
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.billingEvent.create.mockResolvedValue({});
      mockTrialQueue.add.mockResolvedValue({});

      await service.startTrial('t1');

      const d7Call = mockTrialQueue.add.mock.calls.find((c: unknown[]) => c[0] === 'trial-reminder-d7');
      expect(d7Call[2].delay).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('endTrial', () => {
    it('sets plan_tier back to starter and clears trial_ends_at', async () => {
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.billingEvent.create.mockResolvedValue({});

      await service.endTrial('t1');

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { plan_tier: 'starter', trial_ends_at: null },
      });
    });

    it('writes trial_ended billing event', async () => {
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.billingEvent.create.mockResolvedValue({});

      await service.endTrial('t1');

      expect(mockPrisma.billingEvent.create).toHaveBeenCalledWith({
        data: { tenant_id: 't1', event_type: 'trial_ended' },
      });
    });
  });
});
