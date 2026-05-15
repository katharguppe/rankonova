import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications.service';
import {
  CreateNotificationDto,
  NotificationSeverity,
  NotificationType,
} from '../notifications.types';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;

  const mockTenantId = 'tenant-test-001';
  const mockClientId = 'client-test-001';
  const mockNotificationId = 'notif-test-001';

  const mockNotification = {
    id: mockNotificationId,
    tenant_id: mockTenantId,
    client_id: mockClientId,
    type: NotificationType.CITATION_DROP,
    severity: NotificationSeverity.CRITICAL,
    title: 'Citation Rate Drop',
    body: 'Your citation rate dropped by 15 points',
    deep_link: '/dashboard/citations',
    is_read: false,
    email_sent: false,
    created_at: new Date('2026-05-15T08:00:00Z'),
    updated_at: new Date('2026-05-15T08:00:00Z'),
  };

  const mockHighNotification = {
    id: 'notif-high-001',
    tenant_id: mockTenantId,
    client_id: mockClientId,
    type: NotificationType.CONTENT_DRAFT_READY,
    severity: NotificationSeverity.HIGH,
    title: 'Content Draft Ready',
    body: 'Your content draft is ready for review',
    deep_link: '/dashboard/content',
    is_read: false,
    email_sent: false,
    created_at: new Date('2026-05-15T09:00:00Z'),
    updated_at: new Date('2026-05-15T09:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification with correct fields', async () => {
      const dto: CreateNotificationDto = {
        clientId: mockClientId,
        type: NotificationType.CITATION_DROP,
        severity: NotificationSeverity.CRITICAL,
        title: 'Citation Rate Drop',
        body: 'Your citation rate dropped by 15 points',
        deepLink: '/dashboard/citations',
      };

      (prisma.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );

      const result = await service.create(dto, mockTenantId);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          tenant_id: mockTenantId,
          client_id: mockClientId,
          type: NotificationType.CITATION_DROP,
          severity: NotificationSeverity.CRITICAL,
          title: 'Citation Rate Drop',
          body: 'Your citation rate dropped by 15 points',
          deep_link: '/dashboard/citations',
          is_read: false,
          email_sent: false,
        },
      });

      expect(result).toEqual({
        id: mockNotificationId,
        tenantId: mockTenantId,
        clientId: mockClientId,
        type: NotificationType.CITATION_DROP,
        severity: NotificationSeverity.CRITICAL,
        title: 'Citation Rate Drop',
        body: 'Your citation rate dropped by 15 points',
        deepLink: '/dashboard/citations',
        isRead: false,
        emailSent: false,
        createdAt: mockNotification.created_at,
        updatedAt: mockNotification.updated_at,
      });
    });

    it('should create notification without clientId', async () => {
      const dto: CreateNotificationDto = {
        type: NotificationType.PAYMENT_FAILED,
        severity: NotificationSeverity.CRITICAL,
        title: 'Payment Failed',
        body: 'Your payment failed',
      };

      const notificationWithoutClient = { ...mockNotification, client_id: null };
      (prisma.notification.create as jest.Mock).mockResolvedValue(
        notificationWithoutClient,
      );

      const result = await service.create(dto, mockTenantId);

      expect(result.clientId).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should return notifications in DESC order by created_at with pagination', async () => {
      const mockNotifications = [mockNotification, mockHighNotification];
      const expectedCount = 2;
      const expectedUnreadCount = 2;

      (prisma.notification.findMany as jest.Mock).mockResolvedValue(
        mockNotifications,
      );
      (prisma.notification.count as jest.Mock)
        .mockResolvedValueOnce(expectedCount)
        .mockResolvedValueOnce(expectedUnreadCount);

      const result = await service.findAll(mockTenantId, mockClientId, 50, 0);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          client_id: mockClientId,
        },
        orderBy: { created_at: 'desc' },
        take: 50,
        skip: 0,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe(mockNotification.id);
      expect(result.total).toBe(expectedCount);
      expect(result.unreadCount).toBe(expectedUnreadCount);
    });

    it('should include proper pagination with limit and offset', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notification.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(25);

      await service.findAll(mockTenantId, mockClientId, 25, 50);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          client_id: mockClientId,
        },
        orderBy: { created_at: 'desc' },
        take: 25,
        skip: 50,
      });
    });

    it('should convert snake_case to camelCase in response', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([
        mockNotification,
      ]);
      (prisma.notification.count as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      const result = await service.findAll(mockTenantId, mockClientId);

      expect(result.data[0]).toEqual({
        id: mockNotificationId,
        tenantId: mockTenantId,
        clientId: mockClientId,
        type: NotificationType.CITATION_DROP,
        severity: NotificationSeverity.CRITICAL,
        title: 'Citation Rate Drop',
        body: 'Your citation rate dropped by 15 points',
        deepLink: '/dashboard/citations',
        isRead: false,
        emailSent: false,
        createdAt: mockNotification.created_at,
        updatedAt: mockNotification.updated_at,
      });
    });
  });

  describe('markAsRead', () => {
    it('should update is_read flag to true', async () => {
      const updatedNotification = { ...mockNotification, is_read: true };
      (prisma.notification.update as jest.Mock).mockResolvedValue(
        updatedNotification,
      );

      const result = await service.markAsRead(mockNotificationId, true);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: mockNotificationId },
        data: { is_read: true },
      });

      expect(result.isRead).toBe(true);
    });

    it('should update is_read flag to false', async () => {
      const unreadNotification = { ...mockNotification, is_read: false };
      (prisma.notification.update as jest.Mock).mockResolvedValue(
        unreadNotification,
      );

      const result = await service.markAsRead(mockNotificationId, false);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: mockNotificationId },
        data: { is_read: false },
      });

      expect(result.isRead).toBe(false);
    });

    it('should be idempotent (calling twice with same value should work)', async () => {
      const readNotification = { ...mockNotification, is_read: true };
      (prisma.notification.update as jest.Mock).mockResolvedValue(
        readNotification,
      );

      const result1 = await service.markAsRead(mockNotificationId, true);
      const result2 = await service.markAsRead(mockNotificationId, true);

      expect(prisma.notification.update).toHaveBeenCalledTimes(2);
      expect(result1.isRead).toBe(true);
      expect(result2.isRead).toBe(true);
    });
  });

  describe('findBatchableHigh', () => {
    it('should return HIGH severity notifications unsent from past 24h', async () => {
      const now = new Date('2026-05-15T10:00:00Z');
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      (prisma.notification.findMany as jest.Mock).mockResolvedValue([
        mockHighNotification,
      ]);

      const result = await service.findBatchableHigh(since);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          severity: NotificationSeverity.HIGH,
          email_sent: false,
          created_at: { gte: since },
        },
        orderBy: { created_at: 'asc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockHighNotification.id);
      expect(result[0].severity).toBe(NotificationSeverity.HIGH);
    });

    it('should not return CRITICAL notifications', async () => {
      const now = new Date('2026-05-15T10:00:00Z');
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await service.findBatchableHigh(since);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          severity: NotificationSeverity.HIGH,
          email_sent: false,
          created_at: { gte: since },
        },
        orderBy: { created_at: 'asc' },
      });
    });

    it('should not return MEDIUM notifications', async () => {
      const now = new Date('2026-05-15T10:00:00Z');
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await service.findBatchableHigh(since);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          severity: NotificationSeverity.HIGH,
          email_sent: false,
          created_at: { gte: since },
        },
        orderBy: { created_at: 'asc' },
      });
    });

    it('should not return already-sent notifications', async () => {
      const now = new Date('2026-05-15T10:00:00Z');
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await service.findBatchableHigh(since);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          severity: NotificationSeverity.HIGH,
          email_sent: false,
          created_at: { gte: since },
        },
        orderBy: { created_at: 'asc' },
      });
    });

    it('should order results by created_at ASC', async () => {
      const now = new Date('2026-05-15T10:00:00Z');
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const olderNotif = { ...mockHighNotification, id: 'notif-001' };
      const newerNotif = { ...mockHighNotification, id: 'notif-002' };
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([
        olderNotif,
        newerNotif,
      ]);

      const result = await service.findBatchableHigh(since);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          severity: NotificationSeverity.HIGH,
          email_sent: false,
          created_at: { gte: since },
        },
        orderBy: { created_at: 'asc' },
      });

      expect(result[0].id).toBe('notif-001');
      expect(result[1].id).toBe('notif-002');
    });
  });

  describe('markDigestSent', () => {
    it('should bulk update email_sent flag to true', async () => {
      const notificationIds = [
        'notif-001',
        'notif-002',
        'notif-003',
      ];

      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.markDigestSent(notificationIds);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: notificationIds } },
        data: { email_sent: true },
      });
    });

    it('should handle empty array gracefully', async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      await service.markDigestSent([]);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [] } },
        data: { email_sent: true },
      });
    });

    it('should handle large batch of IDs', async () => {
      const notificationIds = Array.from({ length: 100 }, (_, i) =>
        `notif-${i}`,
      );

      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 100,
      });

      await service.markDigestSent(notificationIds);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: notificationIds } },
        data: { email_sent: true },
      });
    });
  });
});
