import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from '../billing.controller';
import { BillingService } from '../billing.service';
import { PlanTier } from '@prisma/client';

const TENANT_ID = 'tenant-abc-123';
const mockUser = { userId: 'user-1', tenantId: TENANT_ID, role: 'admin' };

function makeReq(overrides: object = {}) {
  return { user: mockUser, headers: {}, body: undefined, ...overrides };
}

describe('BillingController', () => {
  let controller: BillingController;

  const mockBilling = {
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    changePlan: jest.fn(),
    startTrial: jest.fn(),
    getStatus: jest.fn(),
    handleWebhook: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: BillingService, useValue: mockBilling }],
    }).compile();

    controller = module.get<BillingController>(BillingController);
  });

  describe('POST /billing/subscribe', () => {
    it('calls createSubscription with tenantId and planTier, returns result', async () => {
      const expected = { id: 'sub-1', plan_tier: PlanTier.growth };
      mockBilling.createSubscription.mockResolvedValue(expected);

      const result = await controller.subscribe(
        makeReq() as any,
        { planTier: PlanTier.growth },
      );

      expect(mockBilling.createSubscription).toHaveBeenCalledWith(TENANT_ID, PlanTier.growth);
      expect(result).toEqual(expected);
    });
  });

  describe('POST /billing/cancel', () => {
    it('calls cancelSubscription with tenantId and returns result', async () => {
      const expected = { cancelled: true };
      mockBilling.cancelSubscription.mockResolvedValue(expected);

      const result = await controller.cancel(makeReq() as any);

      expect(mockBilling.cancelSubscription).toHaveBeenCalledWith(TENANT_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('PATCH /billing/plan', () => {
    it('calls changePlan with tenantId and planTier, returns result', async () => {
      const expected = { plan_tier: PlanTier.enterprise };
      mockBilling.changePlan.mockResolvedValue(expected);

      const result = await controller.changePlan(
        makeReq() as any,
        { planTier: PlanTier.enterprise },
      );

      expect(mockBilling.changePlan).toHaveBeenCalledWith(TENANT_ID, PlanTier.enterprise);
      expect(result).toEqual(expected);
    });
  });

  describe('POST /billing/trial/start', () => {
    it('calls startTrial with tenantId and returns result', async () => {
      const expected = { trial_ends_at: '2026-06-13T00:00:00.000Z' };
      mockBilling.startTrial.mockResolvedValue(expected);

      const result = await controller.startTrial(makeReq() as any);

      expect(mockBilling.startTrial).toHaveBeenCalledWith(TENANT_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('GET /billing/status', () => {
    it('calls getStatus with tenantId and returns status object', async () => {
      const expected = {
        plan_tier: PlanTier.growth,
        billing_suspended: false,
        trial_ends_at: null,
      };
      mockBilling.getStatus.mockResolvedValue(expected);

      const result = await controller.getStatus(makeReq() as any);

      expect(mockBilling.getStatus).toHaveBeenCalledWith(TENANT_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('POST /billing/webhook/razorpay', () => {
    it('calls handleWebhook with body buffer and signature, returns { received: true }', async () => {
      mockBilling.handleWebhook.mockResolvedValue(undefined);
      const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
      const signature = 'sha256=abc123';

      const req = {
        headers: { 'x-razorpay-signature': signature },
        body,
      };

      const result = await controller.razorpayWebhook(req as any);

      expect(mockBilling.handleWebhook).toHaveBeenCalledWith(body, signature);
      expect(result).toEqual({ received: true });
    });
  });
});
