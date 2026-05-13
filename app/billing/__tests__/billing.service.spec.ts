import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { SubscriptionService } from '../subscription.service';
import { TrialService } from '../trial.service';
import { WebhookService } from '../webhook.service';
import { InvoiceService } from '../invoice.service';
import { PlanEnforcementService } from '../plan-enforcement.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockRazorpay = {};

const mockSubscriptions = {
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  changePlan: jest.fn(),
};

const mockTrial = {
  startTrial: jest.fn(),
};

const mockWebhook = {
  handleWebhook: jest.fn(),
};

const mockInvoice = {};

const mockEnforcement = {
  assertNotSuspended: jest.fn(),
  assertWithinQuota: jest.fn(),
};

const mockPrisma = {
  tenant: {
    findUniqueOrThrow: jest.fn(),
  },
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: 'RAZORPAY', useValue: mockRazorpay },
        { provide: SubscriptionService, useValue: mockSubscriptions },
        { provide: TrialService, useValue: mockTrial },
        { provide: WebhookService, useValue: mockWebhook },
        { provide: InvoiceService, useValue: mockInvoice },
        { provide: PlanEnforcementService, useValue: mockEnforcement },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  describe('createSubscription', () => {
    it('delegates to SubscriptionService.createSubscription', async () => {
      mockSubscriptions.createSubscription.mockResolvedValue(undefined);
      await service.createSubscription('tenant-1', 'growth');
      expect(mockSubscriptions.createSubscription).toHaveBeenCalledWith('tenant-1', 'growth');
    });
  });

  describe('cancelSubscription', () => {
    it('delegates to SubscriptionService.cancelSubscription', async () => {
      mockSubscriptions.cancelSubscription.mockResolvedValue(undefined);
      await service.cancelSubscription('tenant-1');
      expect(mockSubscriptions.cancelSubscription).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('changePlan', () => {
    it('delegates to SubscriptionService.changePlan', async () => {
      mockSubscriptions.changePlan.mockResolvedValue(undefined);
      await service.changePlan('tenant-1', 'enterprise');
      expect(mockSubscriptions.changePlan).toHaveBeenCalledWith('tenant-1', 'enterprise');
    });
  });

  describe('startTrial', () => {
    it('delegates to TrialService.startTrial', async () => {
      mockTrial.startTrial.mockResolvedValue(undefined);
      await service.startTrial('tenant-1');
      expect(mockTrial.startTrial).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('getStatus', () => {
    it('fetches tenant and returns plan_tier, billing_suspended, trial_ends_at', async () => {
      const trialDate = new Date('2026-06-01');
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({
        plan_tier: 'growth',
        billing_suspended: false,
        trial_ends_at: trialDate,
      });

      const result = await service.getStatus('tenant-1');

      expect(mockPrisma.tenant.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        select: { plan_tier: true, billing_suspended: true, trial_ends_at: true },
      });
      expect(result).toEqual({
        plan_tier: 'growth',
        billing_suspended: false,
        trial_ends_at: trialDate,
      });
    });
  });

  describe('handleWebhook', () => {
    it('delegates to WebhookService.handleWebhook', async () => {
      mockWebhook.handleWebhook.mockResolvedValue(undefined);
      const body = Buffer.from('{}');
      const sig = 'abc123';
      await service.handleWebhook(body, sig);
      expect(mockWebhook.handleWebhook).toHaveBeenCalledWith(body, sig);
    });
  });

  describe('assertNotSuspended', () => {
    it('delegates to PlanEnforcementService.assertNotSuspended', async () => {
      mockEnforcement.assertNotSuspended.mockResolvedValue(undefined);
      await service.assertNotSuspended('tenant-1');
      expect(mockEnforcement.assertNotSuspended).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('assertWithinQuota', () => {
    it('delegates to PlanEnforcementService.assertWithinQuota', async () => {
      mockEnforcement.assertWithinQuota.mockResolvedValue(undefined);
      await service.assertWithinQuota('tenant-1');
      expect(mockEnforcement.assertWithinQuota).toHaveBeenCalledWith('tenant-1');
    });
  });
});
