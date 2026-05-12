import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationSeverity } from '@prisma/client';

@Injectable()
export class NotificationTrigger {
  private readonly logger = new Logger(NotificationTrigger.name);

  constructor(private readonly prisma: PrismaService) {}

  async triggerBriefNotification(clientId: string, citationDelta: number): Promise<void> {
    try {
      const client = await this.prisma.client.findFirst({
        where: { id: clientId },
        select: { tenant_id: true },
      });

      if (!client) return;

      const severity: NotificationSeverity = citationDelta < 0 ? 'medium' : 'low';
      const title = citationDelta < 0 ? 'Citation score dropped' : 'Weekly brief ready';
      const body = `Your weekly action digest is ready. Citation score: ${citationDelta > 0 ? '+' : ''}${citationDelta.toFixed(1)}%`;

      await this.prisma.notification.create({
        data: {
          tenant_id: client.tenant_id,
          client_id: clientId,
          type: 'weekly_brief',
          severity,
          title,
          body,
          deep_link: `/dashboard/${clientId}/briefs`,
        },
      });

      this.logger.log(`Notification created for client ${clientId}`);
    } catch (err) {
      this.logger.error(`Failed to create notification: ${(err as Error).message}`);
    }
  }
}
