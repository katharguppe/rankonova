import { Logger } from '@nestjs/common';
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { BILLING_PURGE_QUEUE } from '../billing.constants';

interface PurgeJobData {
  tenantId: string;
}

@Processor(BILLING_PURGE_QUEUE)
export class TenantPurgeProcessor {
  private readonly logger = new Logger(TenantPurgeProcessor.name);

  @Process('purge-tenant')
  async onPurge(job: Job<PurgeJobData>): Promise<void> {
    this.logger.warn(
      `[billing-purge] Tenant ${job.data.tenantId} 90-day retention elapsed — manual purge required`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<PurgeJobData>, err: Error): void {
    this.logger.error(
      `Purge job failed for tenant ${job.data.tenantId}: ${err.message}`,
    );
  }
}
