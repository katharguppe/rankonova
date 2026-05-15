import { Test, TestingModule } from '@nestjs/testing';
import { DigestCronJob } from '../digest-cron.job';
import { NotificationsService } from '../notifications.service';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType, NotificationSeverity, NotificationResponseDto } from '../notifications.types';

describe('DigestCronJob', () => {
  let job: DigestCronJob;
  let notificationsService: NotificationsService;
  let mailService: MailService;

  const mockTenantId = 'tenant-test-001';
  const mockClientId1 = 'client-test-001';
  const mockClientId2 = 'client-test-002';

  const createMockNotification = (
    id: string,
    clientId: string,
    type: NotificationType,
    severity: NotificationSeverity,
  ): NotificationResponseDto => ({
    id,
    tenantId: mockTenantId,
    clientId,
    type,
    severity,
    title: `Notification ${id}`,
    body: `Body for ${id}`,
    isRead: false,
    emailSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestCronJob,
        {
          provide: NotificationsService,
          useValue: {
            findBatchableHigh: jest.fn(),
            markDigestSent: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendDigestEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    job = module.get<DigestCronJob>(DigestCronJob);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    mailService = module.get<MailService>(MailService);
  });

  describe('handle', () => {
    it('should send digest email with HIGH notifications from past 24h', async () => {
      const n1 = createMockNotification(
        'notif-1',
        mockClientId1,
        NotificationType.CONTENT_DRAFT_READY,
        NotificationSeverity.HIGH,
      );

      const n2 = createMockNotification(
        'notif-2',
        mockClientId1,
        NotificationType.GAP_REPORT,
        NotificationSeverity.HIGH,
      );

      jest
        .spyOn(notificationsService, 'findBatchableHigh')
        .mockResolvedValue([n1, n2]);

      await job.handle();

      expect(mailService.sendDigestEmail).toHaveBeenCalled();
      expect(notificationsService.markDigestSent).toHaveBeenCalledWith([
        'notif-1',
        'notif-2',
      ]);
    });

    it('should mark notifications as email_sent after sending', async () => {
      const n1 = createMockNotification(
        'notif-1',
        mockClientId1,
        NotificationType.CONTENT_DRAFT_READY,
        NotificationSeverity.HIGH,
      );

      jest.spyOn(notificationsService, 'findBatchableHigh').mockResolvedValue([n1]);

      await job.handle();

      expect(notificationsService.markDigestSent).toHaveBeenCalledWith(['notif-1']);
    });

    it('should group notifications by client', async () => {
      const n1 = createMockNotification(
        'notif-1',
        mockClientId1,
        NotificationType.CONTENT_DRAFT_READY,
        NotificationSeverity.HIGH,
      );

      const n2 = createMockNotification(
        'notif-2',
        mockClientId2,
        NotificationType.GAP_REPORT,
        NotificationSeverity.HIGH,
      );

      jest
        .spyOn(notificationsService, 'findBatchableHigh')
        .mockResolvedValue([n1, n2]);

      await job.handle();

      // Should call sendDigestEmail twice (once per client)
      expect(mailService.sendDigestEmail).toHaveBeenCalledTimes(2);
      expect(mailService.sendDigestEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: mockClientId1,
          notifications: [n1],
        }),
      );
      expect(mailService.sendDigestEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: mockClientId2,
          notifications: [n2],
        }),
      );
    });

    it('should not send if no HIGH notifications', async () => {
      jest.spyOn(notificationsService, 'findBatchableHigh').mockResolvedValue([]);

      await job.handle();

      // Should not call sendDigestEmail if no notifications
      expect(mailService.sendDigestEmail).not.toHaveBeenCalled();
      expect(notificationsService.markDigestSent).not.toHaveBeenCalled();
    });
  });
});
