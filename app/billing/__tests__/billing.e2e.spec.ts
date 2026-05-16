/**
 * Billing E2E Integration Tests
 *
 * Wires the full billing HTTP layer (controller + all services) using
 * NestJS TestingModule with mocked PrismaService, MailService, Bull queues,
 * and the RAZORPAY token. No real DB, SMTP, or payment-gateway calls.
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as express from 'express';
import { getQueueToken } from '@nestjs/bull';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { BillingController } from '../billing.controller';
import { BillingService } from '../billing.service';
import { SubscriptionService } from '../subscription.service';
import { TrialService } from '../trial.service';
import { InvoiceService } from '../invoice.service';
import { WebhookService } from '../webhook.service';
import { PlanEnforcementService } from '../plan-enforcement.service';
import { BillingGuard } from '../billing.guard';
import { TrialProcessor } from '../processors/trial.processor';
import { PaymentRetryProcessor } from '../processors/payment-retry.processor';
import { TenantPurgeProcessor } from '../processors/tenant-purge.processor';

import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { IRazorpayService } from '../razorpay.interface';
import {
  BILLING_TRIAL_QUEUE,
  BILLING_RETRY_QUEUE,
  BILLING_PURGE_QUEUE,
} from '../billing.constants';
import { signWebhookPayload } from '../test-helpers/sign-webhook';

const WEBHOOK_SECRET = 'test-secret';
const TENANT_ID = 'tenant-e2e-001';

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeQueueStub() {
  return { add: jest.fn().mockResolvedValue(undefined) };
}

function makePrismaMock() {
  return {
    tenant: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    billingEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
    promptRun: {
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

function makeMailMock() {
  return {
    sendInvoiceEmail: jest.fn().mockResolvedValue(undefined),
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  };
}

function makeRazorpayMock(): jest.Mocked<IRazorpayService> {
  return {
    createSubscription: jest.fn().mockResolvedValue({
      id: 'sub_test_001',
      status: 'created',
      planId: 'plan_growth',
      tenantId: TENANT_ID,
      createdAt: Math.floor(Date.now() / 1000),
    }),
    fetchSubscription: jest.fn().mockResolvedValue({
      id: 'sub_test_001',
      status: 'halted',
      planId: 'plan_growth',
      tenantId: TENANT_ID,
      createdAt: Math.floor(Date.now() / 1000),
    }),
    cancelSubscription: jest.fn().mockResolvedValue({ cancelled: true }),
    capturePayment: jest.fn().mockResolvedValue({
      paymentId: 'pay_001',
      status: 'captured',
      amount: 99900,
    }),
    buildWebhookPayload: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Module builder
// ---------------------------------------------------------------------------

interface TestContext {
  app: INestApplication;
  prismaMock: ReturnType<typeof makePrismaMock>;
  mailMock: ReturnType<typeof makeMailMock>;
  razorpayMock: jest.Mocked<IRazorpayService>;
  trialQueueStub: ReturnType<typeof makeQueueStub>;
  retryQueueStub: ReturnType<typeof makeQueueStub>;
  purgeQueueStub: ReturnType<typeof makeQueueStub>;
}

async function buildApp(overrides: {
  prismaMock?: ReturnType<typeof makePrismaMock>;
  mailMock?: ReturnType<typeof makeMailMock>;
  razorpayMock?: jest.Mocked<IRazorpayService>;
} = {}): Promise<TestContext> {
  const prismaMock = overrides.prismaMock ?? makePrismaMock();
  const mailMock = overrides.mailMock ?? makeMailMock();
  const razorpayMock = overrides.razorpayMock ?? makeRazorpayMock();
  const trialQueueStub = makeQueueStub();
  const retryQueueStub = makeQueueStub();
  const purgeQueueStub = makeQueueStub();

  const moduleRef = await Test.createTestingModule({
    controllers: [BillingController],
    providers: [
      BillingService,
      SubscriptionService,
      TrialService,
      InvoiceService,
      WebhookService,
      PlanEnforcementService,
      BillingGuard,
      TrialProcessor,
      PaymentRetryProcessor,
      TenantPurgeProcessor,
      { provide: PrismaService, useValue: prismaMock },
      { provide: MailService, useValue: mailMock },
      { provide: 'RAZORPAY', useValue: razorpayMock },
      { provide: getQueueToken(BILLING_TRIAL_QUEUE), useValue: trialQueueStub },
      { provide: getQueueToken(BILLING_RETRY_QUEUE), useValue: retryQueueStub },
      { provide: getQueueToken(BILLING_PURGE_QUEUE), useValue: purgeQueueStub },
      { provide: EventEmitter2, useValue: { emit: jest.fn() } },
    ],
  }).compile();

  const app = moduleRef.createNestApplication({ bodyParser: false });

  // Register raw body parser BEFORE json parser so webhook route gets a Buffer
  app.use('/billing/webhook/razorpay', express.raw({ type: '*/*' }));
  // All other routes get JSON-parsed bodies
  app.use(express.json());

  await app.init();
  return { app, prismaMock, mailMock, razorpayMock, trialQueueStub, retryQueueStub, purgeQueueStub };
}

// ---------------------------------------------------------------------------
// Webhook payload helper
// ---------------------------------------------------------------------------

function buildWebhookBody(event: string, payloadData: Record<string, unknown> = {}): { bodyStr: string; sig: string } {
  const raw = {
    entity: 'event',
    event,
    created_at: Math.floor(Date.now() / 1000),
    payload: payloadData,
  };
  const bodyStr = JSON.stringify(raw);
  const sig = signWebhookPayload(WEBHOOK_SECRET, bodyStr);
  return { bodyStr, sig };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Billing E2E', () => {
  let originalSecret: string | undefined;

  beforeAll(() => {
    originalSecret = process.env['RAZORPAY_WEBHOOK_SECRET'];
    process.env['RAZORPAY_WEBHOOK_SECRET'] = WEBHOOK_SECRET;
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env['RAZORPAY_WEBHOOK_SECRET'];
    } else {
      process.env['RAZORPAY_WEBHOOK_SECRET'] = originalSecret;
    }
  });

  // =========================================================================
  // Scenario 1: Happy path — trial → subscribe → payment.captured → invoice
  // =========================================================================
  describe('Scenario 1: Happy path — trial -> subscribe -> payment captured -> invoice emailed', () => {
    let ctx: TestContext;

    beforeEach(async () => {
      const prismaMock = makePrismaMock();
      prismaMock.tenant.findUniqueOrThrow.mockResolvedValue({
        id: TENANT_ID,
        name: 'E2E Corp',
        billing_email: 'billing@e2ecorp.test',
        plan_tier: 'growth',
        billing_suspended: false,
        trial_ends_at: null,
        razorpay_subscription_id: null,
      } as any);
      ctx = await buildApp({ prismaMock });
    });

    afterEach(async () => {
      await ctx.app.close();
    });

    it('startTrial sets plan_tier=growth and writes trial_started event', async () => {
      const trialService = ctx.app.get(TrialService);
      await trialService.startTrial(TENANT_ID);

      expect(ctx.prismaMock.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TENANT_ID },
          data: expect.objectContaining({ plan_tier: 'growth' }),
        }),
      );

      expect(ctx.prismaMock.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            event_type: 'trial_started',
          }),
        }),
      );

      expect(ctx.trialQueueStub.add).toHaveBeenCalledTimes(3);
    });

    it('createSubscription sets razorpay_subscription_id and writes subscription_created event', async () => {
      const subscriptionService = ctx.app.get(SubscriptionService);
      await subscriptionService.createSubscription(TENANT_ID, 'growth');

      expect(ctx.razorpayMock.createSubscription).toHaveBeenCalledWith(
        expect.any(String),
        TENANT_ID,
      );

      expect(ctx.prismaMock.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TENANT_ID },
          data: expect.objectContaining({
            razorpay_subscription_id: 'sub_test_001',
            billing_suspended: false,
          }),
        }),
      );

      expect(ctx.prismaMock.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            event_type: 'subscription_created',
          }),
        }),
      );
    });

    it('POST /billing/webhook/razorpay with payment.captured writes payment_succeeded and emails invoice', async () => {
      const { bodyStr, sig } = buildWebhookBody('payment.captured', {
        payment: {
          entity: {
            id: 'pay_001',
            amount: 99900,
            notes: { tenant_id: TENANT_ID },
          },
        },
      });

      const res = await request(ctx.app.getHttpServer())
        .post('/billing/webhook/razorpay')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', sig)
        .send(bodyStr);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });

      expect(ctx.mailMock.sendInvoiceEmail).toHaveBeenCalledWith(
        'billing@e2ecorp.test',
        'pay_001',
        99900,
        expect.any(Buffer),
      );

      expect(ctx.prismaMock.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            event_type: 'payment_succeeded',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Scenario 2: Failed payment -> D+7 no recovery -> tenant suspended
  // =========================================================================
  describe('Scenario 2: Failed payment -> D+7 no recovery -> suspended', () => {
    let ctx: TestContext;

    beforeEach(async () => {
      const prismaMock = makePrismaMock();
      prismaMock.tenant.findUniqueOrThrow.mockResolvedValue({
        id: TENANT_ID,
        name: 'E2E Corp',
        billing_email: 'billing@e2ecorp.test',
        plan_tier: 'growth',
        billing_suspended: false,
        trial_ends_at: null,
        razorpay_subscription_id: 'sub_test_001',
      } as any);

      const razorpayMock = makeRazorpayMock();
      // subscription remains halted — no recovery
      razorpayMock.fetchSubscription.mockResolvedValue({
        id: 'sub_test_001',
        status: 'halted',
        planId: 'plan_growth',
        tenantId: TENANT_ID,
        createdAt: Math.floor(Date.now() / 1000),
      });

      ctx = await buildApp({ prismaMock, razorpayMock });
    });

    afterEach(async () => {
      await ctx.app.close();
    });

    it('POST /billing/webhook/razorpay with subscription.halted enqueues 3 retry jobs and writes payment_failed event', async () => {
      const { bodyStr, sig } = buildWebhookBody('subscription.halted', {
        subscription: {
          entity: {
            id: 'sub_test_001',
            notes: { tenant_id: TENANT_ID },
          },
        },
      });

      const res = await request(ctx.app.getHttpServer())
        .post('/billing/webhook/razorpay')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', sig)
        .send(bodyStr);

      expect(res.status).toBe(200);

      expect(ctx.prismaMock.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            event_type: 'payment_failed',
          }),
        }),
      );

      expect(ctx.retryQueueStub.add).toHaveBeenCalledTimes(3);
      const jobNames = ctx.retryQueueStub.add.mock.calls.map(
        (c: unknown[]) => c[0] as string,
      );
      expect(jobNames).toContain('retry-d1');
      expect(jobNames).toContain('retry-d3');
      expect(jobNames).toContain('retry-d7');
    });

    it('D+7 processor suspends tenant when subscription is still halted', async () => {
      const retryProcessor = ctx.app.get(PaymentRetryProcessor);
      const planEnforcement = ctx.app.get(PlanEnforcementService);
      const suspendSpy = jest.spyOn(planEnforcement, 'suspendTenant').mockResolvedValue(undefined);

      const fakeJob = { data: { tenantId: TENANT_ID }, name: 'retry-d7' } as any;
      await retryProcessor.onRetryD7(fakeJob);

      expect(suspendSpy).toHaveBeenCalledWith(TENANT_ID);
    });

    it('assertNotSuspended throws 402 when billing_suspended is true', async () => {
      ctx.prismaMock.tenant.findUniqueOrThrow.mockResolvedValueOnce({
        billing_suspended: true,
      } as any);

      const planEnforcement = ctx.app.get(PlanEnforcementService);

      await expect(
        planEnforcement.assertNotSuspended(TENANT_ID),
      ).rejects.toMatchObject({ status: 402 });
    });
  });

  // =========================================================================
  // Scenario 3: Cancellation
  // =========================================================================
  describe('Scenario 3: Cancellation', () => {
    let ctx: TestContext;

    beforeEach(async () => {
      const prismaMock = makePrismaMock();
      prismaMock.tenant.findUniqueOrThrow.mockResolvedValue({
        id: TENANT_ID,
        razorpay_subscription_id: 'sub_test_001',
      } as any);

      ctx = await buildApp({ prismaMock });
    });

    afterEach(async () => {
      await ctx.app.close();
    });

    it('cancelSubscription writes subscription_cancelled event, sets billing_suspended=true, and enqueues purge job', async () => {
      const subscriptionService = ctx.app.get(SubscriptionService);
      await subscriptionService.cancelSubscription(TENANT_ID);

      expect(ctx.razorpayMock.cancelSubscription).toHaveBeenCalledWith('sub_test_001');

      expect(ctx.prismaMock.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TENANT_ID },
          data: expect.objectContaining({
            billing_suspended: true,
            razorpay_subscription_id: null,
          }),
        }),
      );

      expect(ctx.prismaMock.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            event_type: 'subscription_cancelled',
          }),
        }),
      );

      expect(ctx.purgeQueueStub.add).toHaveBeenCalledWith(
        'purge-tenant',
        { tenantId: TENANT_ID },
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });
  });
});
