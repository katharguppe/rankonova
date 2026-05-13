import { Inject, Logger } from '@nestjs/common';
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanEnforcementService } from '../plan-enforcement.service';
import { IRazorpayService } from '../razorpay.interface';
import { BILLING_RETRY_QUEUE } from '../billing.constants';

interface RetryJobData {
  tenantId: string;
}

@Processor(BILLING_RETRY_QUEUE)
export class PaymentRetryProcessor {
  private readonly logger = new Logger(PaymentRetryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planEnforcement: PlanEnforcementService,
    @Inject('RAZORPAY') private readonly razorpay: IRazorpayService,
  ) {}

  @Process('retry-d1')
  async onRetryD1(job: Job<RetryJobData>): Promise<void> {
    await this.checkRecovery(job.data.tenantId);
  }

  @Process('retry-d3')
  async onRetryD3(job: Job<RetryJobData>): Promise<void> {
    await this.checkRecovery(job.data.tenantId);
  }

  @Process('retry-d7')
  async onRetryD7(job: Job<RetryJobData>): Promise<void> {
    const recovered = await this.checkRecovery(job.data.tenantId);
    if (!recovered) {
      this.logger.warn(
        `Tenant ${job.data.tenantId} not recovered after D+7 — suspending`,
      );
      await this.planEnforcement.suspendTenant(job.data.tenantId);
    }
  }

  private async checkRecovery(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { razorpay_subscription_id: true },
    });
    if (!tenant.razorpay_subscription_id) return false;
    const sub = await this.razorpay.fetchSubscription(
      tenant.razorpay_subscription_id,
    );
    if (sub.status === 'active') {
      await this.planEnforcement.unsuspendTenant(tenantId);
      return true;
    }
    return false;
  }

  @OnQueueFailed()
  onFailed(job: Job<RetryJobData>, err: Error): void {
    this.logger.error(
      `Retry job ${job.name} failed for tenant ${job.data.tenantId}: ${err.message}`,
    );
  }
}
