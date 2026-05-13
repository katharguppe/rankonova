import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PlanTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IRazorpayService } from './razorpay.interface';
import { BILLING_PURGE_QUEUE } from './billing.constants';

const PLAN_ENV_KEYS: Record<PlanTier, string> = {
  starter: 'RAZORPAY_PLAN_ID_STARTER',
  growth: 'RAZORPAY_PLAN_ID_GROWTH',
  enterprise: 'RAZORPAY_PLAN_ID_ENTERPRISE',
};

const TIER_RANK: Record<PlanTier, number> = { starter: 1, growth: 2, enterprise: 3 };

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('RAZORPAY') private readonly razorpay: IRazorpayService,
    @InjectQueue(BILLING_PURGE_QUEUE) private readonly purgeQueue: Queue,
  ) {}

  async createSubscription(tenantId: string, planTier: PlanTier): Promise<void> {
    const planId = process.env[PLAN_ENV_KEYS[planTier]] ?? `plan_${planTier}`;
    const sub = await this.razorpay.createSubscription(planId, tenantId);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan_tier: planTier, razorpay_subscription_id: sub.id, billing_suspended: false },
    });
    await this.prisma.billingEvent.create({
      data: { tenant_id: tenantId, event_type: 'subscription_created', plan_to: planTier },
    });
  }

  async cancelSubscription(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { razorpay_subscription_id: true },
    });
    if (tenant.razorpay_subscription_id) {
      await this.razorpay.cancelSubscription(tenant.razorpay_subscription_id);
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { billing_suspended: true, razorpay_subscription_id: null },
    });
    await this.prisma.billingEvent.create({
      data: { tenant_id: tenantId, event_type: 'subscription_cancelled' },
    });
    await this.purgeQueue.add(
      'purge-tenant',
      { tenantId },
      { delay: 90 * 24 * 60 * 60 * 1000 },
    );
  }

  async changePlan(tenantId: string, newTier: PlanTier): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan_tier: true },
    });
    const oldTier = tenant.plan_tier;
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { plan_tier: newTier } });
    const isUpgrade = TIER_RANK[newTier] > TIER_RANK[oldTier];
    await this.prisma.billingEvent.create({
      data: {
        tenant_id: tenantId,
        event_type: isUpgrade ? 'plan_upgraded' : 'plan_downgraded',
        plan_from: oldTier,
        plan_to: newTier,
      },
    });
  }
}
