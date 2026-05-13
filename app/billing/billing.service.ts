import { Inject, Injectable } from '@nestjs/common';
import { PlanTier } from '@prisma/client';
import { IRazorpayService } from './razorpay.interface';
import { SubscriptionService } from './subscription.service';
import { TrialService } from './trial.service';
import { WebhookService } from './webhook.service';
import { InvoiceService } from './invoice.service';
import { PlanEnforcementService } from './plan-enforcement.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(
    @Inject('RAZORPAY') private readonly razorpay: IRazorpayService,
    private readonly subscriptions: SubscriptionService,
    private readonly trial: TrialService,
    private readonly webhook: WebhookService,
    private readonly invoice: InvoiceService,
    private readonly enforcement: PlanEnforcementService,
    private readonly prisma: PrismaService,
  ) {}

  createSubscription(tenantId: string, planTier: PlanTier) {
    return this.subscriptions.createSubscription(tenantId, planTier);
  }

  cancelSubscription(tenantId: string) {
    return this.subscriptions.cancelSubscription(tenantId);
  }

  changePlan(tenantId: string, planTier: PlanTier) {
    return this.subscriptions.changePlan(tenantId, planTier);
  }

  startTrial(tenantId: string) {
    return this.trial.startTrial(tenantId);
  }

  async getStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan_tier: true, billing_suspended: true, trial_ends_at: true },
    });
    return {
      plan_tier: tenant.plan_tier,
      billing_suspended: tenant.billing_suspended,
      trial_ends_at: tenant.trial_ends_at,
    };
  }

  handleWebhook(body: Buffer, signature: string) {
    return this.webhook.handleWebhook(body, signature);
  }

  assertNotSuspended(tenantId: string) {
    return this.enforcement.assertNotSuspended(tenantId);
  }

  assertWithinQuota(tenantId: string) {
    return this.enforcement.assertWithinQuota(tenantId);
  }
}
