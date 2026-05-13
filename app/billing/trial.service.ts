import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { BILLING_TRIAL_QUEUE } from './billing.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TrialService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(BILLING_TRIAL_QUEUE) private readonly trialQueue: Queue,
  ) {}

  async startTrial(tenantId: string): Promise<void> {
    const trialEndsAt = new Date(Date.now() + 14 * DAY_MS);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan_tier: 'growth', trial_ends_at: trialEndsAt },
    });
    await this.prisma.billingEvent.create({
      data: { tenant_id: tenantId, event_type: 'trial_started' },
    });
    await this.trialQueue.add('trial-reminder-d7', { tenantId }, { delay: 7 * DAY_MS });
    await this.trialQueue.add('trial-reminder-d12', { tenantId }, { delay: 12 * DAY_MS });
    await this.trialQueue.add('trial-end', { tenantId }, { delay: 14 * DAY_MS });
  }

  async endTrial(tenantId: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan_tier: 'starter', trial_ends_at: null },
    });
    await this.prisma.billingEvent.create({
      data: { tenant_id: tenantId, event_type: 'trial_ended' },
    });
  }
}
