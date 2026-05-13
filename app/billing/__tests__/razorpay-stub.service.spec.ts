// app/billing/__tests__/razorpay-stub.service.spec.ts

import { RazorpayStubService } from '../razorpay-stub.service';
import { RazorpayStubError } from '../razorpay-stub.error';

describe('RazorpayStubService', () => {
  let service: RazorpayStubService;

  beforeEach(() => {
    service = new RazorpayStubService();
  });

  // ── createSubscription ────────────────────────────────────────────────────

  describe('createSubscription', () => {
    it('returns a subscription object on success', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const sub = await service.createSubscription('plan_starter', 'tenant_abc');
      expect(sub.id).toMatch(/^sub_stub_/);
      expect(sub.status).toBe('created');
      expect(sub.planId).toBe('plan_starter');
      expect(sub.tenantId).toBe('tenant_abc');
      expect(typeof sub.createdAt).toBe('number');
      jest.restoreAllMocks();
    });

    it('throws RazorpayStubError on failure', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.95);
      await expect(
        service.createSubscription('plan_starter', 'tenant_abc'),
      ).rejects.toBeInstanceOf(RazorpayStubError);
      jest.restoreAllMocks();
    });

    it('throws with code subscription_creation_failed on failure', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.95);
      await expect(
        service.createSubscription('plan_starter', 'tenant_abc'),
      ).rejects.toMatchObject({ code: 'subscription_creation_failed' });
      jest.restoreAllMocks();
    });

    it('succeeds ~70% of the time over 100 calls', async () => {
      jest.restoreAllMocks();
      let successes = 0;
      for (let i = 0; i < 100; i++) {
        try {
          await service.createSubscription('plan_starter', 'tenant_abc');
          successes++;
        } catch {
          // expected
        }
      }
      expect(successes).toBeGreaterThanOrEqual(40);
      expect(successes).toBeLessThanOrEqual(100);
    });
  });

  // ── fetchSubscription ─────────────────────────────────────────────────────

  describe('fetchSubscription', () => {
    it('returns a subscription on success', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const sub = await service.fetchSubscription('sub_stub_abc123');
      expect(sub.id).toBe('sub_stub_abc123');
      expect(['active', 'halted']).toContain(sub.status);
      jest.restoreAllMocks();
    });

    it('throws RazorpayStubError with code subscription_not_found on failure', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      await expect(
        service.fetchSubscription('sub_stub_abc123'),
      ).rejects.toMatchObject({ code: 'subscription_not_found' });
      jest.restoreAllMocks();
    });
  });

  // ── cancelSubscription ────────────────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('always returns { cancelled: true }', async () => {
      const result = await service.cancelSubscription('sub_stub_abc123');
      expect(result).toEqual({ cancelled: true });
    });

    it('never throws', async () => {
      await expect(
        service.cancelSubscription('sub_stub_abc123'),
      ).resolves.toBeDefined();
    });
  });

  // ── capturePayment ────────────────────────────────────────────────────────

  describe('capturePayment', () => {
    it('returns payment result on success', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const result = await service.capturePayment('pay_stub_xyz', 500000);
      expect(result.paymentId).toBe('pay_stub_xyz');
      expect(result.status).toBe('captured');
      expect(result.amount).toBe(500000);
      jest.restoreAllMocks();
    });

    it('throws RazorpayStubError with code payment_failed on failure', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      await expect(
        service.capturePayment('pay_stub_xyz', 500000),
      ).rejects.toMatchObject({ code: 'payment_failed' });
      jest.restoreAllMocks();
    });

    it('succeeds ~60% of the time over 100 calls', async () => {
      jest.restoreAllMocks();
      let successes = 0;
      for (let i = 0; i < 100; i++) {
        try {
          await service.capturePayment('pay_stub_xyz', 500000);
          successes++;
        } catch {
          // expected
        }
      }
      expect(successes).toBeGreaterThanOrEqual(30);
      expect(successes).toBeLessThanOrEqual(90);
    });
  });

  // ── buildWebhookPayload ───────────────────────────────────────────────────

  describe('buildWebhookPayload', () => {
    it('wraps data in standard Razorpay envelope', () => {
      const payload = service.buildWebhookPayload('payment.captured', {
        payment: { id: 'pay_stub_xyz', amount: 500000 },
      });
      expect(payload.entity).toBe('event');
      expect(payload.event).toBe('payment.captured');
      expect(payload.payload).toEqual({
        payment: { id: 'pay_stub_xyz', amount: 500000 },
      });
      expect(typeof payload.created_at).toBe('number');
    });

    it('works for subscription.halted event', () => {
      const payload = service.buildWebhookPayload('subscription.halted', {
        subscription: { id: 'sub_stub_abc' },
      });
      expect(payload.event).toBe('subscription.halted');
    });

    it('works for subscription.cancelled event', () => {
      const payload = service.buildWebhookPayload('subscription.cancelled', {
        subscription: { id: 'sub_stub_abc' },
      });
      expect(payload.event).toBe('subscription.cancelled');
    });

    it('never throws', () => {
      expect(() =>
        service.buildWebhookPayload('payment.captured', {}),
      ).not.toThrow();
    });
  });
});
