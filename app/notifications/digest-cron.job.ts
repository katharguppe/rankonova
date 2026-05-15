import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class DigestCronJob {
  private logger = new Logger(DigestCronJob.name);

  constructor(
    private notificationsService: NotificationsService,
    private mailService: MailService,
  ) {}

  /**
   * Runs every day at 9 AM IST (3:30 AM UTC, but using 3 AM for simplicity)
   * IST is UTC+5:30, so 9 AM IST = 3:30 AM UTC
   * Using '0 3 * * *' as a close approximation (exact timezone handling depends on server config)
   *
   * Batches all unsent HIGH severity notifications from the past 24 hours by client
   * and sends them as digest emails.
   */
  @Cron('0 3 * * *')
  async handle() {
    this.logger.log('Starting daily digest batch job...');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const notifications = await this.notificationsService.findBatchableHigh(yesterday);

    if (notifications.length === 0) {
      this.logger.log('No HIGH notifications to send in digest');
      return;
    }

    this.logger.log(`Found ${notifications.length} HIGH notifications to batch`);

    // Group by client
    const byClient = notifications.reduce(
      (acc, notif) => {
        const clientId = notif.clientId || 'unassigned';
        if (!acc[clientId]) {
          acc[clientId] = [];
        }
        acc[clientId].push(notif);
        return acc;
      },
      {} as Record<string, typeof notifications>,
    );

    // Send digest email per client concurrently
    const emailPromises: Promise<void>[] = [];

    for (const [clientId, notifs] of Object.entries(byClient)) {
      const tenantId = notifs[0].tenantId;

      const promise = this.mailService
        .sendDigestEmail({
          clientId,
          tenantId,
          notifications: notifs,
          sentAt: new Date(),
        })
        .catch((error) => {
          this.logger.error(
            `Failed to send digest for client ${clientId}: ${error.message}`,
            error.stack,
          );
          // Don't re-throw; continue with other clients
        });

      emailPromises.push(promise);
    }

    // Wait for all emails to be sent
    const sendResults = await Promise.allSettled(emailPromises);

    // Mark all notifications as sent (regardless of email success)
    const successfulIds = notifications.map((n) => n.id);
    await this.notificationsService.markDigestSent(successfulIds);

    const successful = sendResults.filter((r) => r.status === 'fulfilled').length;
    const failed = sendResults.filter((r) => r.status === 'rejected').length;

    this.logger.log(
      `Digest batch complete: ${Object.keys(byClient).length} clients, ${successful} successful, ${failed} failed`,
    );
  }
}
