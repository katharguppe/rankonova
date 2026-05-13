import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { WebhookService } from '../webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice.service';
import { PlanEnforcementService } from '../plan-enforcement.service';
import { BILLING_RETRY_QUEUE } from '../billing.constants';
import { signWebhookPayload } from '../test-helpers/sign-webhook';

const SECRET = 'test-secret';

function makePayload(event: string, data: object): Buffer {
  return Buffer.from(JSON.stringify({ entity: 'event', event, payload: data, created_at: 0 }));
}

describe('WebhookService', () => {
  let service: WebhookService;
  const mockPrisma = { billingEvent: { create: jest.fn() } };
  const mockInvoice = { generateAndSend: jest.fn() };
  const mockEnforcement = { suspendTenant: jest.fn() };
  const mockRetryQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env['RAZORPAY_WEBHOOK_SECRET'] = SECRET;
    const module = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceService, useValue: mockInvoice },
        { provide: PlanEnforcementService, useValue: mockEnforcement },
        { provide: getQueueToken(BILLING_RETRY_QUEUE), useValue: mockRetryQueue },
      ],
    }).compile();
    service = module.get(WebhookService);
  });

  it('throws 400 when signature is invalid', async () => {
    const body = makePayload('payment.captured', {});
    await expect(service.handleWebhook(body, 'bad-sig')).rejects.toThrow(HttpException);
    const err = await service.handleWebhook(body, 'bad-sig').catch((e: unknown) => e) as HttpException;
    expect(err.getStatus()).toBe(400);
  });

  it('calls generateAndSend on payment.captured', async () => {
    const paymentData = {
      payment: { entity: { id: 'pay_123', amount: 500000, notes: { tenant_id: 't1' } } },
    };
    const body = makePayload('payment.captured', paymentData);
    const sig = signWebhookPayload(SECRET, body);
    mockInvoice.generateAndSend.mockResolvedValue(undefined);

    await service.handleWebhook(body, sig);

    expect(mockInvoice.generateAndSend).toHaveBeenCalledWith('t1', 'pay_123', 500000);
  });

  it('enqueues 3 retry jobs on subscription.halted', async () => {
    const subData = { subscription: { entity: { notes: { tenant_id: 't1' } } } };
    const body = makePayload('subscription.halted', subData);
    const sig = signWebhookPayload(SECRET, body);
    mockRetryQueue.add.mockResolvedValue({});
    mockPrisma.billingEvent.create.mockResolvedValue({});

    await service.handleWebhook(body, sig);

    expect(mockRetryQueue.add).toHaveBeenCalledTimes(3);
    const jobNames = mockRetryQueue.add.mock.calls.map((c: unknown[]) => c[0]);
    expect(jobNames).toContain('retry-d1');
    expect(jobNames).toContain('retry-d3');
    expect(jobNames).toContain('retry-d7');
  });

  it('calls suspendTenant on subscription.cancelled', async () => {
    const subData = { subscription: { entity: { notes: { tenant_id: 't1' } } } };
    const body = makePayload('subscription.cancelled', subData);
    const sig = signWebhookPayload(SECRET, body);
    mockEnforcement.suspendTenant.mockResolvedValue(undefined);

    await service.handleWebhook(body, sig);

    expect(mockEnforcement.suspendTenant).toHaveBeenCalledWith('t1');
  });
});
