import { createHmac, timingSafeEqual } from 'crypto';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from './invoice.service';
import { PlanEnforcementService } from './plan-enforcement.service';
import { RazorpayWebhookPayload } from './razorpay.interface';
import { BILLING_RETRY_QUEUE } from './billing.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly planEnforcement: PlanEnforcementService,
    @InjectQueue(BILLING_RETRY_QUEUE) private readonly retryQueue: Queue,
  ) {}

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secret = process.env['RAZORPAY_WEBHOOK_SECRET'];
    if (!secret) throw new HttpException('RAZORPAY_WEBHOOK_SECRET not configured', 500);
    const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!signature || signature.length !== 64) {
      throw new HttpException('Invalid webhook signature', 400);
    }
    const isValid = timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signature, 'hex'));
    if (!isValid) {
      throw new HttpException('Invalid webhook signature', 400);
    }
    const payload: RazorpayWebhookPayload = JSON.parse(rawBody.toString()) as RazorpayWebhookPayload;
    try {
      switch (payload.event) {
        case 'payment.captured':
          return await this.onPaymentCaptured(payload);
        case 'subscription.halted':
          return await this.onSubscriptionHalted(payload);
        case 'subscription.cancelled':
          return await this.onSubscriptionCancelled(payload);
        default:
          return;
      }
    } catch (err) {
      this.logger.error(`Webhook handler failed for event ${payload.event}: ${(err as Error).message}`);
    }
  }

  private async onPaymentCaptured(payload: RazorpayWebhookPayload): Promise<void> {
    const payment = (payload.payload['payment'] as { entity: { id: string; amount: number; notes: { tenant_id: string } } }).entity;
    await this.invoiceService.generateAndSend(payment.notes.tenant_id, payment.id, payment.amount);
  }

  private async onSubscriptionHalted(payload: RazorpayWebhookPayload): Promise<void> {
    const sub = (payload.payload['subscription'] as { entity: { notes: { tenant_id: string } } }).entity;
    const tenantId = sub.notes.tenant_id;
    await this.prisma.billingEvent.create({
      data: { tenant_id: tenantId, event_type: 'payment_failed' },
    });
    await this.retryQueue.add('retry-d1', { tenantId }, { delay: 1 * DAY_MS });
    await this.retryQueue.add('retry-d3', { tenantId }, { delay: 3 * DAY_MS });
    await this.retryQueue.add('retry-d7', { tenantId }, { delay: 7 * DAY_MS });
  }

  private async onSubscriptionCancelled(payload: RazorpayWebhookPayload): Promise<void> {
    const sub = (payload.payload['subscription'] as { entity: { notes: { tenant_id: string } } }).entity;
    await this.planEnforcement.suspendTenant(sub.notes.tenant_id);
  }
}
