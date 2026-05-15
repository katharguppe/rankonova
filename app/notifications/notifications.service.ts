import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateNotificationDto,
  NotificationResponseDto,
  NotificationSeverity,
  NotificationType,
} from './notifications.types';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new notification in the database
   * Converts camelCase DTO to snake_case for database storage
   *
   * @param dto - CreateNotificationDto with camelCase field names
   * @param tenantId - The tenant owning this notification
   * @returns NotificationResponseDto with camelCase field names
   */
  async create(
    dto: CreateNotificationDto,
    tenantId: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.create({
      data: {
        tenant_id: tenantId,
        client_id: dto.clientId,
        type: dto.type,
        severity: dto.severity,
        title: dto.title,
        body: dto.body,
        deep_link: dto.deepLink,
        is_read: false,
        email_sent: false,
      },
    });

    return this.mapToDto(notification);
  }

  /**
   * Find all notifications for a tenant and client with pagination
   * Returns notifications in descending order by created_at (newest first)
   * Includes total count and unread count for UI badge
   *
   * @param tenantId - Tenant ID for tenant-scoping
   * @param clientId - Client ID to filter by
   * @param limit - Max results per page (default: 50)
   * @param offset - Pagination offset (default: 0)
   * @returns Object with data array, total count, and unread count
   */
  async findAll(
    tenantId: string,
    clientId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{
    data: NotificationResponseDto[];
    total: number;
    unreadCount: number;
  }> {
    const where = {
      tenant_id: tenantId,
      client_id: clientId,
    };

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.notification.count({ where });

    const unreadCount = await this.prisma.notification.count({
      where: {
        ...where,
        is_read: false,
      },
    });

    return {
      data: notifications.map((n) => this.mapToDto(n)),
      total,
      unreadCount,
    };
  }

  /**
   * Mark a notification as read or unread
   * Updates the is_read flag and returns the updated notification
   * Idempotent: calling multiple times with same value is safe
   *
   * @param notificationId - Notification ID to update
   * @param isRead - Whether to mark as read (true) or unread (false)
   * @returns Updated NotificationResponseDto
   */
  async markAsRead(
    notificationId: string,
    isRead: boolean,
  ): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: isRead },
    });

    return this.mapToDto(notification);
  }

  /**
   * Find HIGH severity notifications ready for digest batching
   * Returns unsent notifications from the past 24 hours
   * Ordered by created_at ASC (oldest first for FIFO processing)
   *
   * Filters:
   * - severity = 'high' (batched in daily digest)
   * - email_sent = false (not yet included in digest)
   * - created_at >= since (within 24h window)
   *
   * @param since - Start time for the 24h window (e.g., now - 24h)
   * @returns Array of NotificationResponseDto ordered by age
   */
  async findBatchableHigh(since: Date): Promise<NotificationResponseDto[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        severity: NotificationSeverity.HIGH,
        email_sent: false,
        created_at: { gte: since },
      },
      orderBy: { created_at: 'asc' },
    });

    return notifications.map((n) => this.mapToDto(n));
  }

  /**
   * Bulk update email_sent flag for digest notifications
   * Called after digest email is successfully sent
   * Marks all notifications in the batch as sent to prevent duplicates
   *
   * @param notificationIds - Array of notification IDs to mark as sent
   * @returns Promise resolves when all updates complete
   */
  async markDigestSent(notificationIds: string[]): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: { in: notificationIds } },
      data: { email_sent: true },
    });
  }

  /**
   * Private helper to convert Prisma snake_case to DTO camelCase
   * Handles optional fields gracefully (undefined if null in DB)
   * Note: type is stored as string in DB but cast to NotificationType enum in DTO
   * severity comes as enum from Prisma and is cast for compatibility
   *
   * @param notification - Raw notification from Prisma
   * @returns NotificationResponseDto with camelCase field names
   */
  private mapToDto(notification: {
    id: string;
    tenant_id: string;
    client_id: string | null;
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    severity: any;
    title: string;
    body: string;
    deep_link: string | null;
    is_read: boolean;
    email_sent: boolean;
    created_at: Date;
    updated_at: Date;
  }): NotificationResponseDto {
    return {
      id: notification.id,
      tenantId: notification.tenant_id,
      clientId: notification.client_id || undefined,
      type: notification.type as unknown as NotificationType,
      severity: notification.severity as unknown as NotificationSeverity,
      title: notification.title,
      body: notification.body,
      deepLink: notification.deep_link || undefined,
      isRead: notification.is_read,
      emailSent: notification.email_sent,
      createdAt: notification.created_at,
      updatedAt: notification.updated_at,
    };
  }
}
