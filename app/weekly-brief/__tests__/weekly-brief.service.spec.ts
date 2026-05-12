import { Test, TestingModule } from '@nestjs/testing';
import { WeeklyBriefService } from '../weekly-brief.service';
import { CitationCalculator } from '../helpers/citation-calculator';
import { ActionRanker } from '../helpers/action-ranker';
import { BriefGenerator } from '../helpers/brief-generator';
import { EmailSender } from '../helpers/email-sender';
import { NotificationTrigger } from '../helpers/notification-trigger';
import { DownstreamTrigger } from '../helpers/downstream-trigger';
import { PrismaService } from '../../prisma/prisma.service';

describe('WeeklyBriefService', () => {
  let service: WeeklyBriefService;
  let prisma: PrismaService;
  let citationCalculator: CitationCalculator;
  let actionRanker: ActionRanker;
  let briefGenerator: BriefGenerator;
  let emailSender: EmailSender;
  let notificationTrigger: NotificationTrigger;
  let downstreamTrigger: DownstreamTrigger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeeklyBriefService,
        CitationCalculator,
        ActionRanker,
        BriefGenerator,
        EmailSender,
        NotificationTrigger,
        DownstreamTrigger,
        {
          provide: PrismaService,
          useValue: {
            client: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
            tenant: {
              findFirst: jest.fn(),
            },
            weeklyBrief: {
              create: jest.fn(),
              update: jest.fn(),
            },
            brandMention: {
              count: jest.fn(),
            },
            promptRun: {
              count: jest.fn(),
            },
            contentOutput: {
              findMany: jest.fn(),
            },
            prSignal: {
              findMany: jest.fn(),
            },
            communityThread: {
              findMany: jest.fn(),
            },
            reviewSnapshot: {
              findMany: jest.fn(),
            },
            aggregatorSnapshot: {
              findMany: jest.fn(),
            },
            notification: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<WeeklyBriefService>(WeeklyBriefService);
    prisma = module.get<PrismaService>(PrismaService);
    citationCalculator = module.get<CitationCalculator>(CitationCalculator);
    actionRanker = module.get<ActionRanker>(ActionRanker);
    briefGenerator = module.get<BriefGenerator>(BriefGenerator);
    emailSender = module.get<EmailSender>(EmailSender);
    notificationTrigger = module.get<NotificationTrigger>(NotificationTrigger);
    downstreamTrigger = module.get<DownstreamTrigger>(DownstreamTrigger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateWeeklyBriefs', () => {
    it('should iterate all active clients and generate briefs', async () => {
      const monday = new Date('2026-05-12T00:00:00Z');

      (prisma.client.findMany as jest.Mock).mockResolvedValue([
        { id: 'client-1', brand_name: 'Client 1', tenant_id: 'tenant-1' },
        { id: 'client-2', brand_name: 'Client 2', tenant_id: 'tenant-1' },
      ]);

      // Mock citation scores
      jest.spyOn(citationCalculator, 'calculateCitationScore').mockResolvedValue(50);
      jest.spyOn(citationCalculator, 'calculateCitationDelta').mockResolvedValue(5);

      // Mock action ranker to return some actions
      jest.spyOn(actionRanker, 'rankActions').mockResolvedValue([
        {
          action_type: 'content_approval',
          draft_id: 'draft-1',
          title: 'Approve content',
          weight: 3,
          impact_score: 3.3,
          draft_preview: 'Some content preview',
          draft_content_summary: 'Some content summary',
          effort_minutes: 20,
        },
      ]);

      // Mock brief generator
      jest.spyOn(briefGenerator, 'generateBrief').mockResolvedValue({
        headline: 'Test headline',
        intro: 'Test intro',
        sections: [],
        cta: 'Test CTA',
        footer: 'Test footer',
      });

      jest.spyOn(briefGenerator, 'briefToHtml').mockResolvedValue('<html>test</html>');

      // Mock email sender
      jest.spyOn(emailSender, 'sendBrief').mockResolvedValue({ id: 'msg-1' });

      // Mock notification trigger
      jest.spyOn(notificationTrigger, 'triggerBriefNotification').mockResolvedValue();

      // Mock downstream trigger
      jest.spyOn(downstreamTrigger, 'triggerGapReportIfNeeded').mockResolvedValue();
      jest.spyOn(downstreamTrigger, 'triggerContentDraftsForWorstPrompts').mockResolvedValue();

      (prisma.weeklyBrief.create as jest.Mock).mockResolvedValue({ id: 'brief-1' });
      (prisma.weeklyBrief.update as jest.Mock).mockResolvedValue({ id: 'brief-1' });

      await service.generateWeeklyBriefs(monday);

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: true, deleted_at: null }),
        }),
      );
    });

    it('should handle errors gracefully when generating brief for a client fails', async () => {
      const monday = new Date('2026-05-12T00:00:00Z');

      (prisma.client.findMany as jest.Mock).mockResolvedValue([
        { id: 'client-1', email: 'client1@test.local', brand_name: 'Client 1' },
      ]);

      jest.spyOn(citationCalculator, 'calculateCitationScore').mockRejectedValue(new Error('Database error'));

      await expect(service.generateWeeklyBriefs(monday)).resolves.not.toThrow();
    });
  });

  describe('generateBriefForClient', () => {
    it('should skip generation if zero actions pending', async () => {
      const clientId = 'client-no-actions';
      const monday = new Date('2026-05-12T00:00:00Z');

      jest.spyOn(citationCalculator, 'calculateCitationScore').mockResolvedValue(50);
      jest.spyOn(citationCalculator, 'calculateCitationDelta').mockResolvedValue(0);

      jest.spyOn(actionRanker, 'rankActions').mockResolvedValue([]);

      const result = await service.generateBriefForClient(clientId, monday);

      expect(result).toBeNull();
      expect(prisma.weeklyBrief.create).not.toHaveBeenCalled();
    });

    it('should generate brief with ranked actions', async () => {
      const clientId = 'client-1';
      const monday = new Date('2026-05-12T00:00:00Z');
      const tenantId = 'tenant-1';
      const tenantEmail = 'billing@tenant.local';
      const clientName = 'Client 1';

      jest.spyOn(citationCalculator, 'calculateCitationScore').mockResolvedValue(50);
      jest.spyOn(citationCalculator, 'calculateCitationDelta').mockResolvedValue(5);

      jest.spyOn(actionRanker, 'rankActions').mockResolvedValue([
        {
          action_type: 'content_approval',
          draft_id: 'draft-1',
          title: 'Approve content',
          weight: 3,
          impact_score: 3.3,
          draft_preview: 'Preview',
          draft_content_summary: 'Summary',
          effort_minutes: 20,
        },
      ]);

      jest.spyOn(briefGenerator, 'generateBrief').mockResolvedValue({
        headline: 'Test headline',
        intro: 'Test intro',
        sections: [],
        cta: 'Test CTA',
        footer: 'Test footer',
      });

      jest.spyOn(briefGenerator, 'briefToHtml').mockResolvedValue('<html>test</html>');

      jest.spyOn(emailSender, 'sendBrief').mockResolvedValue({ id: 'msg-1' });

      jest.spyOn(notificationTrigger, 'triggerBriefNotification').mockResolvedValue();

      jest.spyOn(downstreamTrigger, 'triggerGapReportIfNeeded').mockResolvedValue();
      jest.spyOn(downstreamTrigger, 'triggerContentDraftsForWorstPrompts').mockResolvedValue();

      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({
        billing_email: tenantEmail,
      });

      (prisma.weeklyBrief.create as jest.Mock).mockResolvedValue({ id: 'brief-1' });
      (prisma.weeklyBrief.update as jest.Mock).mockResolvedValue({ id: 'brief-1' });

      await service.generateBriefForClient(clientId, monday, clientName, tenantId);

      expect(prisma.weeklyBrief.create).toHaveBeenCalled();
      expect(emailSender.sendBrief).toHaveBeenCalledWith(
        tenantEmail,
        clientName,
        '<html>test</html>',
      );
      expect(notificationTrigger.triggerBriefNotification).toHaveBeenCalledWith(clientId, 5);
    });

    it('should trigger GapReport when citation drops', async () => {
      const clientId = 'client-1';
      const monday = new Date('2026-05-12T00:00:00Z');
      const tenantId = 'tenant-1';
      const tenantEmail = 'billing@tenant.local';

      jest.spyOn(citationCalculator, 'calculateCitationScore').mockResolvedValue(40);
      jest.spyOn(citationCalculator, 'calculateCitationDelta').mockResolvedValue(-10);

      jest.spyOn(actionRanker, 'rankActions').mockResolvedValue([
        {
          action_type: 'content_approval',
          draft_id: 'draft-1',
          title: 'Approve content',
          weight: 3,
          impact_score: 3.3,
          draft_preview: 'Preview',
          draft_content_summary: 'Summary',
          effort_minutes: 20,
        },
      ]);

      jest.spyOn(briefGenerator, 'generateBrief').mockResolvedValue({
        headline: 'Test headline',
        intro: 'Test intro',
        sections: [],
        cta: 'Test CTA',
        footer: 'Test footer',
      });

      jest.spyOn(briefGenerator, 'briefToHtml').mockResolvedValue('<html>test</html>');

      jest.spyOn(emailSender, 'sendBrief').mockResolvedValue({ id: 'msg-1' });

      jest.spyOn(notificationTrigger, 'triggerBriefNotification').mockResolvedValue();

      jest.spyOn(downstreamTrigger, 'triggerGapReportIfNeeded').mockResolvedValue();
      jest.spyOn(downstreamTrigger, 'triggerContentDraftsForWorstPrompts').mockResolvedValue();

      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({
        billing_email: tenantEmail,
      });

      (prisma.weeklyBrief.create as jest.Mock).mockResolvedValue({ id: 'brief-1' });
      (prisma.weeklyBrief.update as jest.Mock).mockResolvedValue({ id: 'brief-1' });

      await service.generateBriefForClient(clientId, monday, 'Test Client', tenantId);

      expect(downstreamTrigger.triggerGapReportIfNeeded).toHaveBeenCalledWith(clientId, -10);
    });

    it('should handle email send failure gracefully', async () => {
      const clientId = 'client-1';
      const monday = new Date('2026-05-12T00:00:00Z');
      const tenantId = 'tenant-1';
      const tenantEmail = 'billing@tenant.local';

      jest.spyOn(citationCalculator, 'calculateCitationScore').mockResolvedValue(50);
      jest.spyOn(citationCalculator, 'calculateCitationDelta').mockResolvedValue(5);

      jest.spyOn(actionRanker, 'rankActions').mockResolvedValue([
        {
          action_type: 'content_approval',
          draft_id: 'draft-1',
          title: 'Approve content',
          weight: 3,
          impact_score: 3.3,
          draft_preview: 'Preview',
          draft_content_summary: 'Summary',
          effort_minutes: 20,
        },
      ]);

      jest.spyOn(briefGenerator, 'generateBrief').mockResolvedValue({
        headline: 'Test headline',
        intro: 'Test intro',
        sections: [],
        cta: 'Test CTA',
        footer: 'Test footer',
      });

      jest.spyOn(briefGenerator, 'briefToHtml').mockResolvedValue('<html>test</html>');

      jest.spyOn(emailSender, 'sendBrief').mockRejectedValue(new Error('Email service down'));

      jest.spyOn(notificationTrigger, 'triggerBriefNotification').mockResolvedValue();

      jest.spyOn(downstreamTrigger, 'triggerGapReportIfNeeded').mockResolvedValue();
      jest.spyOn(downstreamTrigger, 'triggerContentDraftsForWorstPrompts').mockResolvedValue();

      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({
        billing_email: tenantEmail,
      });

      (prisma.weeklyBrief.create as jest.Mock).mockResolvedValue({ id: 'brief-1' });

      // Should not throw
      await expect(service.generateBriefForClient(clientId, monday, 'Test Client', tenantId)).resolves.not.toThrow();

      expect(prisma.weeklyBrief.create).toHaveBeenCalled();
    });
  });
});
