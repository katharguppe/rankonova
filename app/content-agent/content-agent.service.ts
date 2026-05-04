import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContentOutput, ContentStatus, ContentType, NotificationSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FaqPageGeneratorService } from './generators/faq-page.generator';
import { ComparisonPageGeneratorService } from './generators/comparison-page.generator';
import { EntityAuthorityPageGeneratorService, VERTICAL_SCHEMA_TYPES } from './generators/entity-authority-page.generator';
import { SegmentArticleGeneratorService } from './generators/segment-article.generator';
import { QualityValidatorService } from './validators/quality-validator';
import { GenerateContentDto } from './dto/generate-content.dto';
import { GeneratedContent } from './content-agent.types';

const BUYER_STAGE_LABELS: Record<string, string> = {
  awareness: 'buyers in the awareness stage researching the category',
  consideration: 'buyers in the consideration stage comparing providers',
  decision: 'buyers ready to make a purchase decision',
  retention: 'existing customers looking to maximise value',
};

// Valid state transitions for the approval workflow
const VALID_TRANSITIONS: Partial<Record<ContentStatus, ContentStatus[]>> = {
  [ContentStatus.draft]: [ContentStatus.approved, ContentStatus.revision_requested],
  [ContentStatus.approved]: [ContentStatus.published, ContentStatus.revision_requested],
};

@Injectable()
export class ContentAgentService {
  private readonly logger = new Logger(ContentAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faqGenerator: FaqPageGeneratorService,
    private readonly comparisonGenerator: ComparisonPageGeneratorService,
    private readonly entityAuthorityGenerator: EntityAuthorityPageGeneratorService,
    private readonly segmentArticleGenerator: SegmentArticleGeneratorService,
    private readonly validator: QualityValidatorService,
  ) {}

  // ── generate ─────────────────────────────────────────────────────────────────

  async generateContent(tenantId: string, dto: GenerateContentDto): Promise<ContentOutput> {
    const { clientId, contentType, targetPromptId } = dto;

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenant_id: tenantId, is_active: true, deleted_at: null },
      include: { vertical: { select: { name: true, slug: true } } },
    });
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);

    const [targetPrompt, latestGap] = await Promise.all([
      targetPromptId
        ? this.prisma.prompt.findFirst({
            where: { id: targetPromptId, is_active: true },
            select: { text: true, buyer_stage: true },
          })
        : Promise.resolve(null),
      this.prisma.gapReport.findFirst({
        where: { client_id: clientId },
        orderBy: { version: 'desc' },
        select: { plain_english_summary: true },
      }),
    ]);

    this.logger.log(`Generating ${contentType} for ${client.brand_name} (${clientId})`);

    const generated = await this.dispatchGenerator(
      tenantId,
      contentType,
      client,
      targetPrompt?.text,
      targetPrompt?.buyer_stage ?? null,
      latestGap?.plain_english_summary,
      undefined,
    );

    const output = await this.saveOutput({
      clientId,
      tenantId,
      targetPromptId,
      contentType,
      generated,
      previousVersionId: null,
    });

    await this.notifyDraftCreated(tenantId, clientId, output.id, output.title, contentType);

    return output;
  }

  // ── approval workflow ─────────────────────────────────────────────────────────

  async approveOutput(tenantId: string, outputId: string, userId: string): Promise<ContentOutput> {
    const output = await this.loadOwnedOutput(tenantId, outputId);
    this.assertValidTransition(outputId, output.status, ContentStatus.approved);

    return this.prisma.contentOutput.update({
      where: { id: outputId },
      data: {
        status: ContentStatus.approved,
        approved_by: userId,
        approved_at: new Date(),
      },
    });
  }

  async requestRevision(
    tenantId: string,
    outputId: string,
    reviewNotes: string,
  ): Promise<ContentOutput> {
    const output = await this.loadOwnedOutput(tenantId, outputId);
    this.assertValidTransition(outputId, output.status, ContentStatus.revision_requested);

    return this.prisma.contentOutput.update({
      where: { id: outputId },
      data: {
        status: ContentStatus.revision_requested,
        review_notes: reviewNotes,
      },
    });
  }

  async regenerateOutput(tenantId: string, outputId: string): Promise<ContentOutput> {
    const original = await this.loadOwnedOutput(tenantId, outputId);

    if (original.status !== ContentStatus.revision_requested) {
      throw new BadRequestException(
        `ContentOutput ${outputId} must be in "revision_requested" status to regenerate (current: "${original.status}")`,
      );
    }

    const client = await this.prisma.client.findFirst({
      where: { id: original.client_id, tenant_id: tenantId, is_active: true, deleted_at: null },
      include: { vertical: { select: { name: true, slug: true } } },
    });
    if (!client) throw new NotFoundException(`Client ${original.client_id} not found`);

    const targetPrompt = original.target_prompt_id
      ? await this.prisma.prompt.findFirst({
          where: { id: original.target_prompt_id, is_active: true },
          select: { text: true, buyer_stage: true },
        })
      : null;

    const latestGap = await this.prisma.gapReport.findFirst({
      where: { client_id: original.client_id },
      orderBy: { version: 'desc' },
      select: { plain_english_summary: true },
    });

    this.logger.log(
      `Regenerating ${original.type} for ${client.brand_name} — incorporating review notes`,
    );

    const generated = await this.dispatchGenerator(
      tenantId,
      original.type,
      client,
      targetPrompt?.text,
      targetPrompt?.buyer_stage ?? null,
      latestGap?.plain_english_summary,
      original.review_notes ?? undefined,
    );

    const newOutput = await this.saveOutput({
      clientId: original.client_id,
      tenantId,
      targetPromptId: original.target_prompt_id ?? undefined,
      contentType: original.type,
      generated,
      previousVersionId: original.id,
    });

    await this.notifyDraftCreated(tenantId, original.client_id, newOutput.id, newOutput.title, original.type);

    return newOutput;
  }

  async publishOutput(tenantId: string, outputId: string): Promise<ContentOutput> {
    const output = await this.loadOwnedOutput(tenantId, outputId);
    this.assertValidTransition(outputId, output.status, ContentStatus.published);

    const followUpAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);

    return this.prisma.contentOutput.update({
      where: { id: outputId },
      data: {
        status: ContentStatus.published,
        published_at: new Date(),
        follow_up_scheduled_at: followUpAt,
      },
    });
  }

  // ── list / get ────────────────────────────────────────────────────────────────

  listOutputs(tenantId: string, clientId: string, status?: ContentStatus) {
    return this.prisma.contentOutput.findMany({
      where: {
        client_id: clientId,
        client: { tenant_id: tenantId },
        ...(status ? { status } : {}),
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        html_content: true,
        review_notes: true,
        previous_version_id: true,
        citation_rate_before: true,
        citation_rate_after: true,
        approved_at: true,
        published_at: true,
        follow_up_scheduled_at: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async getOutput(tenantId: string, outputId: string): Promise<ContentOutput | null> {
    return this.prisma.contentOutput.findFirst({
      where: { id: outputId, client: { tenant_id: tenantId } },
    });
  }

  // ── 60-day follow-up scheduler ────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runFollowUpCapture(): Promise<void> {
    const due = await this.prisma.contentOutput.findMany({
      where: {
        status: ContentStatus.published,
        follow_up_scheduled_at: { lte: new Date() },
        citation_rate_after: null,
      },
      select: { id: true, client_id: true },
    });

    if (due.length === 0) return;

    this.logger.log(`Follow-up capture: ${due.length} published piece(s) due`);

    await Promise.all(
      due.map(async ({ id, client_id }) => {
        const rate = await this.getLatestCitationRate(client_id);
        if (rate === null) return;
        await this.prisma.contentOutput.update({
          where: { id },
          data: { citation_rate_after: rate },
        });
        this.logger.log(`Follow-up captured for output ${id}: citation_rate_after=${rate}%`);
      }),
    );
  }

  // ── private helpers ───────────────────────────────────────────────────────────

  private async dispatchGenerator(
    tenantId: string,
    contentType: ContentType,
    client: {
      id: string;
      name: string;
      brand_name: string;
      city: string;
      state: string;
      website_url: string;
      vertical_id: string;
      vertical: { name: string; slug: string };
    },
    targetQuestion: string | undefined,
    buyerStage: string | null,
    gapSummary: string | undefined,
    revisionNotes: string | undefined,
  ): Promise<GeneratedContent> {
    const base = {
      clientName: client.name,
      brandName: client.brand_name,
      city: client.city,
      state: client.state,
      websiteUrl: client.website_url,
      verticalName: client.vertical.name,
      gapSummary,
      revisionNotes,
    };

    switch (contentType) {
      case ContentType.faq_page:
        return this.faqGenerator.generate({ ...base, targetQuestion });

      case ContentType.comparison_page: {
        const competitors = await this.prisma.competitor.findMany({
          where: { tenant_id: tenantId, vertical_id: client.vertical_id, is_active: true },
          select: { name: true },
          take: 3,
          orderBy: { created_at: 'asc' },
        });
        return this.comparisonGenerator.generate({
          ...base,
          competitorNames: competitors.map((c) => c.name),
        });
      }

      case ContentType.entity_authority_page: {
        const schemaOrgType = VERTICAL_SCHEMA_TYPES[client.vertical.slug] ?? 'LocalBusiness';
        return this.entityAuthorityGenerator.generate({ ...base, schemaOrgType });
      }

      case ContentType.segment_article: {
        const segment =
          targetQuestion ??
          BUYER_STAGE_LABELS[buyerStage ?? ''] ??
          `${client.vertical.name} buyers in ${client.city}`;
        return this.segmentArticleGenerator.generate({ ...base, segment, targetQuestion });
      }
    }
  }

  private async saveOutput(params: {
    clientId: string;
    tenantId: string;
    targetPromptId?: string;
    contentType: ContentType;
    generated: GeneratedContent;
    previousVersionId: string | null;
  }): Promise<ContentOutput> {
    const { clientId, contentType, generated, previousVersionId, targetPromptId } = params;

    const validation = this.validator.validate(generated.title, generated.htmlContent, contentType);

    if (validation.issues.length > 0) {
      this.logger.warn(
        `${validation.issues.length} validation issue(s): ` +
          validation.issues.map((i) => i.rule).join(', '),
      );
    }

    const citationRateBefore = await this.getLatestCitationRate(clientId);

    const output = await this.prisma.contentOutput.create({
      data: {
        client_id: clientId,
        target_prompt_id: targetPromptId ?? null,
        type: contentType,
        title: generated.title,
        html_content: generated.htmlContent,
        schema_json: generated.schemaJson as object,
        generation_prompt: generated.generationPrompt,
        status: ContentStatus.draft,
        review_notes: validation.issues.length > 0
          ? this.validator.formatIssuesSummary(validation.issues)
          : null,
        citation_rate_before: citationRateBefore,
        previous_version_id: previousVersionId,
      },
    });

    this.logger.log(
      `ContentOutput ${output.id} saved — ${contentType}, valid=${validation.valid}, issues=${validation.issues.length}`,
    );

    return output;
  }

  private async notifyDraftCreated(
    tenantId: string,
    clientId: string,
    outputId: string,
    title: string,
    contentType: ContentType,
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          tenant_id: tenantId,
          client_id: clientId,
          type: 'content_draft_ready',
          severity: NotificationSeverity.high,
          title: `Content draft ready: "${title}"`,
          body: `A new ${contentType.replace(/_/g, ' ')} draft is ready for your review and approval.`,
          deep_link: `/content/output/${outputId}`,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to create draft notification for output ${outputId}: ${(err as Error).message}`);
    }
  }

  private async loadOwnedOutput(tenantId: string, outputId: string): Promise<ContentOutput> {
    const output = await this.prisma.contentOutput.findFirst({
      where: { id: outputId, client: { tenant_id: tenantId } },
    });
    if (!output) throw new NotFoundException(`ContentOutput ${outputId} not found`);
    return output;
  }

  private assertValidTransition(
    outputId: string,
    current: ContentStatus,
    target: ContentStatus,
  ): void {
    if (!VALID_TRANSITIONS[current]?.includes(target)) {
      throw new BadRequestException(
        `ContentOutput ${outputId}: cannot transition "${current}" → "${target}"`,
      );
    }
  }

  private async getLatestCitationRate(clientId: string): Promise<number | null> {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [total, cited] = await Promise.all([
      this.prisma.promptRun.count({
        where: { client_id: clientId, ran_at: { gte: cutoff }, status: 'completed' },
      }),
      this.prisma.brandMention.count({
        where: { client_id: clientId, is_client_brand: true, created_at: { gte: cutoff } },
      }),
    ]);
    if (total === 0) return null;
    return Math.round((cited / total) * 1000) / 10;
  }
}
