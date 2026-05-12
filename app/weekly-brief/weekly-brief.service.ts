import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CitationCalculator } from './helpers/citation-calculator';
import { ActionRanker } from './helpers/action-ranker';
import { BriefGenerator } from './helpers/brief-generator';
import { EmailSender } from './helpers/email-sender';
import { NotificationTrigger } from './helpers/notification-trigger';
import { DownstreamTrigger } from './helpers/downstream-trigger';
import { ActionItemForBrief } from './dto/weekly-brief.types';

@Injectable()
export class WeeklyBriefService {
  private readonly logger = new Logger(WeeklyBriefService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly citationCalculator: CitationCalculator,
    private readonly actionRanker: ActionRanker,
    private readonly briefGenerator: BriefGenerator,
    private readonly emailSender: EmailSender,
    private readonly notificationTrigger: NotificationTrigger,
    private readonly downstreamTrigger: DownstreamTrigger,
  ) {}

  @Cron('0 6 * * 1')
  async runScheduledGeneration(): Promise<void> {
    const now = new Date();
    const monday = this.getMonday(now);

    this.logger.log(`Weekly brief generation starting for week of ${monday.toISOString()}`);

    await this.generateWeeklyBriefs(monday);

    this.logger.log('Weekly brief generation complete');
  }

  async generateWeeklyBriefs(weekMonday: Date): Promise<void> {
    const clients = await this.prisma.client.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, brand_name: true, tenant_id: true },
    });

    this.logger.log(`Processing ${clients.length} active client(s)`);

    for (const client of clients) {
      await this.generateBriefForClient(client.id, weekMonday, client.brand_name, client.tenant_id).catch((err) => {
        this.logger.error(
          `Failed to generate brief for client ${client.id} (${client.brand_name}): ${(err as Error).message}`,
        );
      });
    }
  }

  async generateBriefForClient(
    clientId: string,
    weekMonday: Date,
    clientName?: string,
    tenantId?: string,
  ): Promise<void | null> {
    // Ensure tenantId is available (fetch from DB if not provided)
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId) {
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
        select: { tenant_id: true },
      });
      resolvedTenantId = client?.tenant_id;
      if (!resolvedTenantId) {
        this.logger.error(`Client ${clientId}: tenant_id not found; cannot generate brief`);
        return null;
      }
    }

    // Step 1: Compute citation scores
    const citationScore = await this.citationCalculator.calculateCitationScore(clientId, weekMonday);
    const citationDelta = await this.citationCalculator.calculateCitationDelta(clientId, weekMonday);

    this.logger.log(
      `Client ${clientId}: citation_score=${citationScore.toFixed(2)}, delta=${citationDelta.toFixed(2)}`,
    );

    // Step 2: Rank pending actions
    const rankedActions = await this.actionRanker.rankActions(clientId);

    // Step 3: Select top 3 (or fewer)
    const selectedActions = rankedActions.slice(0, 3);

    if (selectedActions.length === 0) {
      this.logger.log(`Client ${clientId}: no pending actions; skipping brief`);
      return null;
    }

    // Step 4: Generate brief (with fallback if API fails)
    let brief;
    try {
      brief = await this.briefGenerator.generateBrief({
        client_id: clientId,
        client_name: clientName || 'Client',
        week_of: weekMonday,
        citation_score: citationScore,
        citation_delta: citationDelta,
        actions: selectedActions,
      });
    } catch (err) {
      this.logger.error(`Failed to generate brief for ${clientId}: ${(err as Error).message}`);
      throw err;
    }

    // Convert to HTML and Markdown
    const briefHtml = await this.briefGenerator.briefToHtml(brief, clientId);
    const briefMarkdown = BriefGenerator.briefToMarkdown(brief);

    // Step 5: Store WeeklyBrief in DB
    const actionItems: ActionItemForBrief[] = selectedActions.map((a) => ({
      action_type: a.action_type,
      title: a.title,
      estimated_impact: a.weight,
      draft_id: a.draft_id,
      draft_preview: a.draft_preview,
      effort_minutes: a.effort_minutes,
    }));

    let weeklyBrief;
    try {
      weeklyBrief = await this.prisma.weeklyBrief.create({
        data: {
          client_id: clientId,
          week_of: weekMonday,
          citation_score: citationScore,
          citation_delta: citationDelta,
          action_items: actionItems as any,
          platform_actions_log: {},
          brief_html: briefHtml,
          brief_markdown: briefMarkdown,
          generated_at: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to save brief for ${clientId}: ${(err as Error).message}`);
      throw err;
    }

    this.logger.log(`WeeklyBrief created: ${weeklyBrief.id}`);

    // Step 6: Send email via SendGrid
    // Fetch tenant's billing email
    let tenantEmail: string | null = null;
    if (tenantId) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { id: tenantId },
        select: { billing_email: true },
      });
      tenantEmail = tenant?.billing_email || null;
    }

    if (tenantEmail) {
      try {
        await this.emailSender.sendBrief(tenantEmail, clientName || 'Client', briefHtml);
        await this.prisma.weeklyBrief.update({
          where: { id: weeklyBrief.id },
          data: { email_sent_at: new Date() },
        });
        this.logger.log(`Email sent for WeeklyBrief ${weeklyBrief.id}`);
      } catch (err) {
        this.logger.error(`Failed to send email: ${(err as Error).message}`);
      }
    }

    // Step 7: Push dashboard notification
    await this.notificationTrigger.triggerBriefNotification(clientId, citationDelta);

    // Step 8: Auto-trigger GapReport if citation dropped
    await this.downstreamTrigger.triggerGapReportIfNeeded(clientId, citationDelta);

    // Step 9: Auto-generate content drafts for worst prompts
    await this.downstreamTrigger.triggerContentDraftsForWorstPrompts(clientId, resolvedTenantId);
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
}
