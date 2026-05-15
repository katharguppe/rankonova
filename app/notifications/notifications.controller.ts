import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import {
  MarkAsReadDto,
  FindNotificationsQueryDto,
  NotificationResponseDto,
} from './notifications.types';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  /**
   * GET /notifications?clientId=X&limit=50&offset=0
   * Public endpoint: returns all notifications for a client with pagination
   *
   * Query params:
   * - clientId (required): The client ID to fetch notifications for
   * - limit (optional, default 50): Max results per page
   * - offset (optional, default 0): Pagination offset
   *
   * Returns: { data: NotificationResponseDto[], total: number, unreadCount: number }
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: FindNotificationsQueryDto,
    @Req() req: Request,
  ) {
    const { clientId, limit = 50, offset = 0 } = query;

    if (!clientId) {
      throw new BadRequestException('clientId is required');
    }

    // Extract tenantId from JWT token (set by AuthGuard)
    const tenantId = (req.user as any)?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId not found in token');
    }

    return this.notificationsService.findAll(tenantId, clientId, limit, offset);
  }

  /**
   * GET /notifications/unread-count?clientId=X
   * Public endpoint: returns unread count for badge display
   *
   * Query param:
   * - clientId (required): The client ID to get unread count for
   *
   * Returns: { unreadCount: number }
   */
  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  async getUnreadCount(
    @Query('clientId') clientId: string,
    @Req() req: Request,
  ) {
    if (!clientId) {
      throw new BadRequestException('clientId is required');
    }

    const tenantId = (req.user as any)?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId not found in token');
    }

    const { unreadCount } = await this.notificationsService.findAll(
      tenantId,
      clientId,
      1,
      0,
    );
    return { unreadCount };
  }

  /**
   * PATCH /notifications/:id/read
   * Public endpoint: mark notification as read or unread
   *
   * Route param:
   * - id (required): Notification ID to update
   *
   * Body: { isRead: boolean }
   *
   * Returns: NotificationResponseDto (updated notification)
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('id') id: string,
    @Body() dto: MarkAsReadDto,
  ): Promise<NotificationResponseDto> {
    if (!id) {
      throw new BadRequestException('id is required');
    }

    return this.notificationsService.markAsRead(id, dto.isRead);
  }

  /**
   * GET /notifications/batch-high?since=<ISO8601>
   * Internal endpoint: fetch HIGH severity notifications for digest batching
   *
   * Used by DigestCronJob to collect unsent HIGH notifications from past 24 hours.
   * Typically protected by internal auth or firewall, not by guard.
   *
   * Query param:
   * - since (required): ISO8601 date string (e.g., "2026-05-15T00:00:00Z")
   *
   * Returns: NotificationResponseDto[] (ordered by created_at ASC, oldest first)
   */
  @Get('batch-high')
  @HttpCode(HttpStatus.OK)
  async getBatchableHigh(
    @Query('since') since: string,
  ): Promise<NotificationResponseDto[]> {
    if (!since) {
      throw new BadRequestException('since is required');
    }

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      throw new BadRequestException('since must be a valid ISO8601 date');
    }

    return this.notificationsService.findBatchableHigh(sinceDate);
  }

  /**
   * PATCH /notifications/send-digest
   * Internal endpoint: placeholder for digest generation testing
   *
   * Actual digest sending logic lives in DigestCronJob.
   * This endpoint is provided for manual testing and dry-run verification.
   *
   * Body (optional): { dryRun?: boolean }
   *
   * Returns: { message: string, dryRun: boolean }
   */
  @Patch('send-digest')
  @HttpCode(HttpStatus.OK)
  async sendDigest(@Body() body?: { dryRun?: boolean }) {
    // This endpoint is just a placeholder; actual implementation is in digest-cron.job.ts
    // Returns success message for testing
    return {
      message:
        'Digest send triggered (actual send handled by DigestCronJob)',
      dryRun: body?.dryRun ?? false,
    };
  }
}
