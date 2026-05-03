import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ContentOutput, ContentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FaqPageGeneratorService } from './generators/faq-page.generator';
import { ComparisonPageGeneratorService } from './generators/comparison-page.generator';
import { EntityAuthorityPageGeneratorService, VERTICAL_SCHEMA_TYPES } from './generators/entity-authority-page.generator';
import { SegmentArticleGeneratorService } from './generators/segment-article.generator';
import { QualityValidatorService } from './validators/quality-validator';
import { GenerateContentDto } from './dto/generate-content.dto';
import { GeneratedContent } from './content-agent.types';

// Buyer-stage / intent labels used as segment descriptions when no targetQuestion is set
const BUYER_STAGE_LABELS: Record<string, string> = {
  awareness: 'buyers in the awareness stage researching the category',
  consideration: 'buyers in the consideration stage comparing providers',
  decision: 'buyers ready to make a purchase decision',
  retention: 'existing customers looking to maximise value',
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

    const gapSummary = latestGap?.plain_english_summary;
    const targetQuestion = targetPrompt?.text;

    this.logger.log(`Generating ${contentType} for ${client.brand_name} (${clientId})`);

    const generated = await this.dispatchGenerator(
      tenantId,
      contentType,
      client,
      targetQuestion,
      targetPrompt?.buyer_stage ?? null,
      gapSummary,
    );

    const validation = this.validator.validate(generated.title, generated.htmlContent, contentType);

    if (validation.issues.length > 0) {
      this.logger.warn(
        `${validation.issues.length} validation issue(s) for ${client.brand_name}: ` +
          validation.issues.map((i) => i.rule).join(', '),
      );
    }

    const reviewNotes = validation.issues.length > 0
      ? this.validator.formatIssuesSummary(validation.issues)
      : null;

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
        status: 'draft',
        review_notes: reviewNotes,
        citation_rate_before: citationRateBefore,
      },
    });

    this.logger.log(
      `ContentOutput ${output.id} saved — ${contentType}, valid=${validation.valid}, issues=${validation.issues.length}`,
    );

    return output;
  }

  listOutputs(tenantId: string, clientId: string) {
    return this.prisma.contentOutput.findMany({
      where: {
        client_id: clientId,
        client: { tenant_id: tenantId },
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        review_notes: true,
        citation_rate_before: true,
        citation_rate_after: true,
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

  // ── private ───────────────────────────────────────────────────────────────────

  private async dispatchGenerator(
    tenantId: string,
    contentType: ContentType,
    client: { id: string; name: string; brand_name: string; city: string; state: string; website_url: string; vertical_id: string; vertical: { name: string; slug: string } },
    targetQuestion: string | undefined,
    buyerStage: string | null,
    gapSummary: string | undefined,
  ): Promise<GeneratedContent> {
    const base = {
      clientName: client.name,
      brandName: client.brand_name,
      city: client.city,
      state: client.state,
      websiteUrl: client.website_url,
      verticalName: client.vertical.name,
      gapSummary,
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
        const schemaOrgType =
          VERTICAL_SCHEMA_TYPES[client.vertical.slug] ?? 'LocalBusiness';
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
