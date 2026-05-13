import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { SubscriptionService } from '../subscription.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BILLING_PURGE_QUEUE } from '../billing.constants';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  const mockPrisma = {
    tenant: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    billingEvent: { create: jest.fn() },
  };
  const mockRazorpay = {
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    fetchSubscription: jest.fn(),
  };
  const mockPurgeQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'RAZORPAY', useValue: mockRazorpay },
        { provide: getQueueToken(BILLING_PURGE_QUEUE), useValue: mockPurgeQueue },
      ],
    }).compile();
    service = module.get(SubscriptionService);
  });

  describe('createSubscription', () => {
    it('creates Razorpay subscription, updates tenant, writes billing event', async () => {
      mockRazorpay.createSubscription.mockResolvedValue({ id: 'sub_test123', status: 'created' });
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.billingEvent.create.mockResolvedValue({});

      await service.createSubscription('tenant-1', 'growth');

      expect(mockRazorpay.createSubscription).toHaveBeenCalledWith(
        expect.stringContaining('plan_growth'),
        'tenant-1',
      );
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1' },
          data: expect.objectContaining({ razorpay_subscription_id: 'sub_test123', billing_suspended: false }),
        }),
      );
      expect(mockPrisma.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event_type: 'subscription_created' }),
        }),
      );
    });
  });

  describe('cancelSubscription', () => {
    it('calls Razorpay cancel, suspends tenant, writes event, enqueues purge job', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ razorpay_subscription_id: 'sub_abc' });
      mockRazorpay.cancelSubscription.mockResolvedValue({ cancelled: true });
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.billingEvent.create.mockResolvedValue({});
      mockPurgeQueue.add.mockResolvedValue({});

      await service.cancelSubscription('tenant-1');

      expect(mockRazorpay.cancelSubscription).toHaveBeenCalledWith('sub_abc');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ billing_suspended: true }) }),
      );
      expect(mockPrisma.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ event_type: 'subscription_cancelled' }) }),
      );
      expect(mockPurgeQueue.add).toHaveBeenCalledWith(
        'purge-tenant',
        { tenantId: 'tenant-1' },
        expect.objectContaining({ delay: 90 * 24 * 60 * 60 * 1000 }),
      );
    });
  });

  describe('changePlan', () => {
    it('updates plan_tier immediately and writes plan_upgraded event for upgrades', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan_tier: 'starter' });
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.billingEvent.create.mockResolvedValue({});

      await service.changePlan('tenant-1', 'growth');

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, data: { plan_tier: 'growth' } });
      expect(mockPrisma.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event_type: 'plan_upgraded', plan_from: 'starter', plan_to: 'growth' }),
        }),
      );
    });

    it('writes plan_downgraded event for downgrades', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan_tier: 'growth' });
      mockPrisma.tenant.update.mockResolvedValue({});
      mockPrisma.billingEvent.create.mockResolvedValue({});

      await service.changePlan('tenant-1', 'starter');

      expect(mockPrisma.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event_type: 'plan_downgraded' }),
        }),
      );
    });
  });
});
