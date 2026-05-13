import { Logger } from '@nestjs/common';
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { TrialService } from '../trial.service';
import { BILLING_TRIAL_QUEUE } from '../billing.constants';

interface TrialJobData {
  tenantId: string;
}

@Processor(BILLING_TRIAL_QUEUE)
export class TrialProcessor {
  private readonly logger = new Logger(TrialProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly trialService: TrialService,
  ) {}

  @Process('trial-reminder-d7')
  async onD7(job: Job<TrialJobData>): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: job.data.tenantId },
      select: { billing_email: true },
    });
    await this.mail.sendTrialReminder(tenant.billing_email, 7);
  }

  @Process('trial-reminder-d12')
  async onD12(job: Job<TrialJobData>): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: job.data.tenantId },
      select: { billing_email: true },
    });
    await this.mail.sendTrialWarning(tenant.billing_email, 2);
  }

  @Process('trial-end')
  async onEnd(job: Job<TrialJobData>): Promise<void> {
    await this.trialService.endTrial(job.data.tenantId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: job.data.tenantId },
      select: { billing_email: true },
    });
    await this.mail.sendTrialEnd(tenant.billing_email);
  }

  @OnQueueFailed()
  onFailed(job: Job<TrialJobData>, err: Error): void {
    this.logger.error(
      `Trial job ${job.name} failed for tenant ${job.data.tenantId}: ${err.message}`,
    );
  }
}
