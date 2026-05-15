import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationHandler } from '../notification.handler';
import { NotificationsService } from '../notifications.service';
import { RateLimiterService } from '../rate-limiter.service';
import { NotificationType, NotificationSeverity } from '../notifications.types';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';

describe('NotificationHandler', () => {
  let handler: NotificationHandler;
  let service: NotificationsService;
  let rateLimiter: RateLimiterService;
  let prisma: PrismaService;
  let mailService: MailService;

  beforeEach(async () => {
    // Mock PrismaService
    const mockPrismaService = {
      notification: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationHandler,
        NotificationsService,
        RateLimiterService,
        EventEmitter2,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MailService,
          useValue: {
            sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: {
            exists: jest.fn().mockResolvedValue(0),
            setex: jest.fn().mockResolvedValue('OK'),
            ttl: jest.fn().mockResolvedValue(3600),
          },
        },
      ],
    }).compile();

    handler = module.get<NotificationHandler>(NotificationHandler);
    service = module.get<NotificationsService>(NotificationsService);
    rateLimiter = module.get<RateLimiterService>(RateLimiterService);
    prisma = module.get<PrismaService>(PrismaService);
    mailService = module.get<MailService>(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onCitationDrop', () => {
    it('should create Critical notification when event fired', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        citationDropPoints: 12,
      };

      const mockNotification = {
        id: 'notif-1',
        tenant_id: 'test-tenant',
        client_id: 'test-client',
        type: NotificationType.CITATION_DROP,
        severity: NotificationSeverity.CRITICAL,
        title: 'Citation Rate Drop Alert',
        body: 'Your citation rate dropped 12 points in the last 24 hours.',
        deep_link: '/dashboard/analytics#citation-trends',
        is_read: false,
        email_sent: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValueOnce(
        mockNotification,
      );

      await handler.onCitationDrop(event);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            client_id: 'test-client',
            type: NotificationType.CITATION_DROP,
            severity: NotificationSeverity.CRITICAL,
          }),
        }),
      );
    });

    it('should send email immediately for Critical notification', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        citationDropPoints: 12,
      };

      const mockNotification = {
        id: 'notif-1',
        tenantId: 'test-tenant',
        clientId: 'test-client',
        type: NotificationType.CITATION_DROP,
        severity: NotificationSeverity.CRITICAL,
        title: 'Citation Rate Drop Alert',
        body: 'Your citation rate dropped 12 points in the last 24 hours.',
        deepLink: '/dashboard/analytics#citation-trends',
        isRead: false,
        emailSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValueOnce(
        mockNotification,
      );

      await handler.onCitationDrop(event);

      expect(mailService.sendNotificationEmail).toHaveBeenCalled();
    });
  });

  describe('onContentDraftReady', () => {
    it('should create High notification when event fired', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        draftId: 'draft-123',
      };

      const mockNotification = {
        id: 'notif-2',
        tenantId: 'test-tenant',
        clientId: 'test-client',
        type: NotificationType.CONTENT_DRAFT_READY,
        severity: NotificationSeverity.HIGH,
        title: 'Content Draft Ready for Review',
        body: 'A new content draft is ready for your review and approval.',
        deepLink: '/dashboard/content/drafts',
        isRead: false,
        emailSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValueOnce(
        mockNotification,
      );

      await handler.onContentDraftReady(event);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            client_id: 'test-client',
            type: NotificationType.CONTENT_DRAFT_READY,
            severity: NotificationSeverity.HIGH,
          }),
        }),
      );
    });

    it('should NOT send email for High notification (digest only)', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        draftId: 'draft-123',
      };

      const mockNotification = {
        id: 'notif-2',
        tenantId: 'test-tenant',
        clientId: 'test-client',
        type: NotificationType.CONTENT_DRAFT_READY,
        severity: NotificationSeverity.HIGH,
        title: 'Content Draft Ready for Review',
        body: 'A new content draft is ready for your review and approval.',
        deepLink: '/dashboard/content/drafts',
        isRead: false,
        emailSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValueOnce(
        mockNotification,
      );

      await handler.onContentDraftReady(event);

      // For HIGH severity, email should not be sent immediately
      // It will be sent via digest job
      expect(mailService.sendNotificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('onAggregatorScore', () => {
    it('should create Medium notification when event fired', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        aggregatorScore: 58,
      };

      const mockNotification = {
        id: 'notif-3',
        tenantId: 'test-tenant',
        clientId: 'test-client',
        type: NotificationType.AGGREGATOR_SCORE,
        severity: NotificationSeverity.MEDIUM,
        title: 'Low Aggregator Score',
        body: 'Your aggregator score dropped below 60.',
        deepLink: '/dashboard/offsite/aggregators',
        isRead: false,
        emailSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValueOnce(
        mockNotification,
      );

      await handler.onAggregatorScore(event);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            client_id: 'test-client',
            type: NotificationType.AGGREGATOR_SCORE,
            severity: NotificationSeverity.MEDIUM,
          }),
        }),
      );
    });
  });

  describe('rate limiting', () => {
    it('should not store notification if rate limit blocks it', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        citationDropPoints: 12,
      };

      const mockNotification = {
        id: 'notif-4',
        tenantId: 'test-tenant',
        clientId: 'test-client',
        type: NotificationType.CITATION_DROP,
        severity: NotificationSeverity.CRITICAL,
        title: 'Citation Rate Drop Alert',
        body: 'Your citation rate dropped 12 points in the last 24 hours.',
        deepLink: '/dashboard/analytics#citation-trends',
        isRead: false,
        emailSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock rate limiter to allow first, block second
      jest
        .spyOn(rateLimiter, 'canSend')
        .mockResolvedValueOnce({ allowed: true })
        .mockResolvedValueOnce({
          allowed: false,
          secondsUntilNext: 3600,
        });

      (prisma.notification.create as jest.Mock).mockResolvedValueOnce(
        mockNotification,
      );

      await handler.onCitationDrop(event);
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);

      await handler.onCitationDrop(event);
      expect(prisma.notification.create).toHaveBeenCalledTimes(1); // Should not create second record
    });

    it('should always allow Critical notifications regardless of rate limit', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        amount: 100,
        currency: 'INR',
      };

      const mockNotification = {
        id: 'notif-5',
        tenantId: 'test-tenant',
        clientId: 'test-client',
        type: NotificationType.PAYMENT_FAILED,
        severity: NotificationSeverity.CRITICAL,
        title: 'Payment Failed',
        body: 'Your subscription payment failed. Please update your payment method.',
        deepLink: '/dashboard/billing',
        isRead: false,
        emailSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );

      // Both calls should succeed for CRITICAL
      await handler.onPaymentFailed(event);
      await handler.onPaymentFailed(event);

      // CRITICAL events bypass rate limiting
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('all 12 event handlers', () => {
    it('should have all CRITICAL handlers', async () => {
      const criticalHandlers = [
        handler.onCitationDrop,
        handler.onCompetitorSpike,
        handler.onNegativeReview24h,
        handler.onPaymentFailed,
        handler.onPromptFailureRate,
      ];

      expect(criticalHandlers).toHaveLength(5);
      criticalHandlers.forEach(h => {
        expect(typeof h).toBe('function');
      });
    });

    it('should have all HIGH handlers', async () => {
      const highHandlers = [
        handler.onCommunityThread,
        handler.onContentDraftReady,
        handler.onGapReport,
        handler.onCompetitorDomain,
      ];

      expect(highHandlers).toHaveLength(4);
      highHandlers.forEach(h => {
        expect(typeof h).toBe('function');
      });
    });

    it('should have all MEDIUM handlers', async () => {
      const mediumHandlers = [
        handler.onAggregatorScore,
        handler.onReviewBacklog,
        handler.onPrOpportunity,
      ];

      expect(mediumHandlers).toHaveLength(3);
      mediumHandlers.forEach(h => {
        expect(typeof h).toBe('function');
      });
    });
  });

  describe('error handling', () => {
    it('should not re-throw errors during email sending', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        amount: 100,
        currency: 'INR',
      };

      const mockNotification = {
        id: 'notif-9',
        tenantId: 'test-tenant',
        clientId: 'test-client',
        type: NotificationType.PAYMENT_FAILED,
        severity: NotificationSeverity.CRITICAL,
        title: 'Payment Failed',
        body: 'Your subscription payment failed. Please update your payment method.',
        deepLink: '/dashboard/billing',
        isRead: false,
        emailSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock mail service to throw error
      (mailService.sendNotificationEmail as jest.Mock).mockRejectedValueOnce(
        new Error('Email service down'),
      );

      (prisma.notification.create as jest.Mock).mockResolvedValueOnce(
        mockNotification,
      );

      // Handler should not re-throw
      await expect(handler.onPaymentFailed(event)).resolves.toBeUndefined();

      // Notification should still be created despite email error
      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });

  describe('event payload extraction', () => {
    it('onCompetitorSpike should extract spikePoints', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        spikePoints: 25,
      };

      const mockNotification = {
        id: 'notif-6',
        tenantId: 'test-tenant',
        clientId: 'test-client',
        type: NotificationType.COMPETITOR_SPIKE,
        severity: NotificationSeverity.CRITICAL,
        title: 'Competitor Mention Spike',
        body: 'Competitor mentions spiked 25 points in the last 24 hours.',
        deepLink: '/dashboard/analytics#competitor-mentions',
        isRead: false,
        emailSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValueOnce(
        mockNotification,
      );

      await handler.onCompetitorSpike(event);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            body: expect.stringContaining('25'),
          }),
        }),
      );
    });

    it('onPromptFailureRate should extract failurePercentage', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        failurePercentage: 35,
        failureCount: 7,
        totalCount: 20,
      };

      const mockNotification = {
        id: 'notif-7',
        tenantId: 'test-tenant',
        clientId: 'test-client',
        type: NotificationType.PROMPT_FAILURE_RATE,
        severity: NotificationSeverity.CRITICAL,
        title: 'High Prompt Failure Rate',
        body: 'Your prompts are failing at a rate of 35% in the last hour.',
        deepLink: '/dashboard/prompts',
        isRead: false,
        emailSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValueOnce(
        mockNotification,
      );

      await handler.onPromptFailureRate(event);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            body: expect.stringContaining('35'),
          }),
        }),
      );
    });

    it('onReviewBacklog should extract backlogCount', async () => {
      const event = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        backlogCount: 42,
      };

      const mockNotification = {
        id: 'notif-8',
        tenantId: 'test-tenant',
        clientId: 'test-client',
        type: NotificationType.REVIEW_BACKLOG,
        severity: NotificationSeverity.MEDIUM,
        title: 'Review Backlog Alert',
        body: 'You have 42 unanswered reviews.',
        deepLink: '/dashboard/reviews',
        isRead: false,
        emailSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValueOnce(
        mockNotification,
      );

      await handler.onReviewBacklog(event);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            body: expect.stringContaining('42'),
          }),
        }),
      );
    });
  });
});
