import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GapReport } from '@prisma/client';
import { CitationDropEvent } from '../analytics/analytics-anomaly.service';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnosticsCrawlerService } from './diagnostics-crawler.service';
import { DiagnosticsDiffService } from './diagnostics-diff.service';
import { DiagnosticsSummaryService } from './diagnostics-summary.service';
import { PageExtraction, OnSiteGaps, OffSiteGaps, RecommendedAction, SiteProfile } from './diagnostics.types';

const MAX_COMPETITOR_URLS = 3;

interface TopCompetitor {
  id: string;
  name: string;
  domain: string;
}

@Injectable()
export class DiagnosticsService {
  private readonly logger = new Logger(DiagnosticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawler: DiagnosticsCrawlerService,
    private readonly diff: DiagnosticsDiffService,
    private readonly summary: DiagnosticsSummaryService,
  ) {}

  // ── event listener ─────────────────────────────────────────────────────────

  @OnEvent('analytics.citation_drop')
  onCitationDrop({ clientId, delta }: CitationDropEvent): void {
    this.logger.log(`Auto-triggering gap report for client ${clientId} (citation drop ${delta.toFixed(1)}pts)`);
    this.generateReport(clientId).catch((err: Error) =>
      this.logger.error(`Auto-triggered gap report failed for ${clientId}: ${err.message}`),
    );
  }

  // ── public API ─────────────────────────────────────────────────────────────

  async generateReport(clientId: string): Promise<GapReport> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, is_active: true, deleted_at: null },
      select: { id: true, brand_name: true, website_url: true, tenant_id: true },
    });
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);

    this.logger.log(`Generating gap report for client ${clientId} (${client.brand_name})`);

    // Fetch competitor config + previous report in parallel
    const [{ topCompetitor, competitorUrls }, previousReport] = await Promise.all([
      this.findTopCompetitor(clientId),
      this.prisma.gapReport.findFirst({
        where: { client_id: clientId },
        orderBy: { version: 'desc' },
      }),
    ]);

    const [competitorPages, clientPages] = await Promise.all([
      this.crawlCompetitorUrls(competitorUrls),
      this.crawler.crawlSite(client.website_url, 10),
    ]);

    // If the client site is entirely unreachable, preserve the previous report's
    // gap scores rather than overwriting with zeros.
    const crawlFailed = clientPages.length === 0 || clientPages.every((p) => !!p.error);

    let dbOnSiteGaps: object;
    let dbOffSiteGaps: object;
    let dbRecommendedActions: object[];
    let summaryOnSite: OnSiteGaps;
    let summaryOffSite: OffSiteGaps;
    let summaryActions: RecommendedAction[];
    let clientProfile: SiteProfile;
    let competitorProfile: SiteProfile;

    if (crawlFailed && previousReport) {
      this.logger.warn(
        `Client site crawl failed entirely for ${clientId} — preserving previous report gaps`,
      );
      dbOnSiteGaps = previousReport.on_site_gaps as object;
      dbOffSiteGaps = previousReport.off_site_gaps as object;
      dbRecommendedActions = previousReport.recommended_actions as object[];
      summaryOnSite = this.fromDbOnSiteGaps(previousReport.on_site_gaps);
      summaryOffSite = this.fromDbOffSiteGaps();
      summaryActions = this.fromDbActions(previousReport.recommended_actions as object[]);
      clientProfile = this.crawler.buildSiteProfile([]);
      competitorProfile = this.crawler.buildSiteProfile([]);
    } else {
      competitorProfile = this.crawler.buildSiteProfile(competitorPages);
      clientProfile = this.crawler.buildSiteProfile(clientPages);
      const { onSiteGaps, offSiteGaps, recommendedActions } = this.diff.computeGaps(
        clientProfile,
        competitorProfile,
      );
      dbOnSiteGaps = this.toDbOnSiteGaps(onSiteGaps);
      dbOffSiteGaps = this.toDbOffSiteGaps(offSiteGaps);
      dbRecommendedActions = this.toDbActions(recommendedActions);
      summaryOnSite = onSiteGaps;
      summaryOffSite = offSiteGaps;
      summaryActions = recommendedActions;
    }

    const plainEnglishSummary = await this.summary.generateSummary({
      clientName: client.brand_name,
      clientWebsite: client.website_url,
      competitorDomain: topCompetitor?.domain ?? 'N/A',
      onSiteGaps: summaryOnSite,
      offSiteGaps: summaryOffSite,
      recommendedActions: summaryActions,
      clientProfile,
      competitorProfile,
    });

    const version = (previousReport?.version ?? 0) + 1;

    const createOps: Promise<unknown>[] = [
      this.prisma.gapReport.create({
        data: {
          client_id: clientId,
          version,
          generated_at: new Date(),
          on_site_gaps: dbOnSiteGaps,
          off_site_gaps: dbOffSiteGaps,
          top_cited_competitor_id: topCompetitor?.id ?? null,
          top_cited_domain: topCompetitor?.domain ?? null,
          plain_english_summary: plainEnglishSummary,
          recommended_actions: dbRecommendedActions as unknown as object[],
          previous_report_id: previousReport?.id ?? null,
        },
      }),
    ];
    if (!crawlFailed) {
      createOps.push(this.upsertCitationSources(competitorPages));
    }

    const [report] = await Promise.all(createOps) as [GapReport, ...unknown[]];

    this.logger.log(`Gap report v${version} stored for client ${clientId}`);
    return report;
  }

  listReports(clientId: string) {
    return this.prisma.gapReport.findMany({
      where: { client_id: clientId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        generated_at: true,
        top_cited_domain: true,
        recommended_actions: true,
        previous_report_id: true,
        created_at: true,
      },
    });
  }

  getLatestReport(clientId: string) {
    return this.prisma.gapReport.findFirst({
      where: { client_id: clientId },
      orderBy: { version: 'desc' },
    });
  }

  // ── pipeline helpers ────────────────────────────────────────────────────────

  private async findTopCompetitor(
    clientId: string,
  ): Promise<{ topCompetitor: TopCompetitor | null; competitorUrls: string[] }> {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const rows = await this.prisma.$queryRaw<{ competitor_id: string; cnt: bigint }[]>`
      SELECT competitor_id, COUNT(*) AS cnt
      FROM brand_mentions
      WHERE client_id = ${clientId}
        AND competitor_id IS NOT NULL
        AND cited_url IS NOT NULL
        AND created_at > ${cutoff}
      GROUP BY competitor_id
      ORDER BY cnt DESC
      LIMIT 1
    `;

    if (rows.length === 0 || !rows[0].competitor_id) {
      this.logger.warn(`No competitor citation data for client ${clientId} — using empty profile`);
      return { topCompetitor: null, competitorUrls: [] };
    }

    const competitorId = rows[0].competitor_id;

    const [competitor, urlRows] = await Promise.all([
      this.prisma.competitor.findUnique({
        where: { id: competitorId },
        select: { id: true, name: true },
      }),
      this.prisma.brandMention.findMany({
        where: {
          client_id: clientId,
          competitor_id: competitorId,
          cited_url: { not: null },
        },
        select: { cited_url: true },
        distinct: ['cited_url'],
        take: MAX_COMPETITOR_URLS + 2, // fetch extras to filter bad URLs
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const competitorUrls = urlRows
      .map((r) => r.cited_url as string)
      .filter((u) => u.startsWith('http'))
      .slice(0, MAX_COMPETITOR_URLS);

    const domain =
      competitorUrls.length > 0
        ? (() => { try { return new URL(competitorUrls[0]).hostname; } catch { return competitorUrls[0]; } })()
        : (competitor?.name ?? 'unknown');

    return {
      topCompetitor: { id: competitorId, name: competitor?.name ?? '', domain },
      competitorUrls,
    };
  }

  private async crawlCompetitorUrls(urls: string[]): Promise<PageExtraction[]> {
    if (urls.length === 0) return [];
    return Promise.all(urls.map((url) => this.crawler.crawlUrl(url)));
  }

  // ── gap format helpers ──────────────────────────────────────────────────────
  // Backend types use camelCase; frontend reads snake_case from JSONB.
  // These helpers translate at the DB boundary.

  private toDbOnSiteGaps(g: OnSiteGaps): object {
    return {
      missing_schema_types: g.missingSchemaTypes,
      faq_coverage_score: g.faqCoverageScore / 100, // 0-100 → 0-1 (frontend multiplies by 100 for %)
      freshness_gap: g.freshnessGap,
      entity_density_gap: g.entityDensityGap,
      internal_link_gap: g.internalLinkGap,
    };
  }

  private toDbOffSiteGaps(_g: OffSiteGaps): object {
    // Off-site gaps are populated by Phase 8 offsite modules; store zeros here.
    return {
      aggregator_presence: 0,
      review_volume_gap: 0,
      community_presence: 0,
      entity_recognition: 0,
      pr_coverage: 0,
    };
  }

  private toDbActions(actions: RecommendedAction[]): object[] {
    const desc: Record<string, string> = {
      high: 'High impact — significant AI citation improvement expected within 4-6 weeks',
      medium: 'Medium impact — moderate citation lift expected within 6-12 weeks',
      low: 'Low impact — gradual improvement over time',
    };
    return actions.map((a) => ({
      action: a.action,
      estimated_impact: desc[a.estimatedImpact] ?? a.estimatedImpact,
      priority: a.estimatedImpact,
    }));
  }

  private fromDbOnSiteGaps(raw: unknown): OnSiteGaps {
    const g = (raw ?? {}) as Record<string, unknown>;
    return {
      missingSchemaTypes: (g['missing_schema_types'] as string[]) ?? [],
      faqCoverageScore: Math.round(((g['faq_coverage_score'] as number) ?? 0) * 100),
      freshnessGap: (g['freshness_gap'] as number) ?? 0,
      entityDensityGap: (g['entity_density_gap'] as number) ?? 0,
      internalLinkGap: (g['internal_link_gap'] as number) ?? 0,
    };
  }

  private fromDbOffSiteGaps(): OffSiteGaps {
    return {
      aggregatorPresence: 'unknown',
      reviewVolumeGap: 0,
      communityPresence: 'unknown',
      entityRecognition: 'unknown',
      prCoverage: 'unknown',
    };
  }

  private fromDbActions(raw: object[]): RecommendedAction[] {
    return (raw as Record<string, unknown>[]).map((a, i) => ({
      action: (a['action'] as string) ?? '',
      estimatedImpact: ((a['priority'] as 'high' | 'medium' | 'low') ?? 'medium'),
      priority: i + 1,
    }));
  }

  private async upsertCitationSources(pages: PageExtraction[]): Promise<void> {
    const crawled = pages.filter((p) => !p.error && p.url.startsWith('http'));
    await Promise.all(
      crawled.map((page) => {
        let domain: string;
        try { domain = new URL(page.url).hostname; }
        catch { domain = page.url; }

        return this.prisma.citationSource.upsert({
          where: { url: page.url },
          create: {
            url: page.url,
            domain,
            schema_types_found: page.schemaTypes,
            has_faq_schema: page.hasFaqSchema,
            word_count: page.wordCount,
            last_crawled_at: page.crawledAt,
          },
          update: {
            schema_types_found: page.schemaTypes,
            has_faq_schema: page.hasFaqSchema,
            word_count: page.wordCount,
            last_crawled_at: page.crawledAt,
          },
        });
      }),
    );
  }
}
