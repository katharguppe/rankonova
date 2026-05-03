import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GapReport } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnosticsCrawlerService } from './diagnostics-crawler.service';
import { DiagnosticsDiffService } from './diagnostics-diff.service';
import { DiagnosticsSummaryService } from './diagnostics-summary.service';
import { PageExtraction } from './diagnostics.types';

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

  // ── public API ─────────────────────────────────────────────────────────────

  async generateReport(clientId: string): Promise<GapReport> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, is_active: true, deleted_at: null },
      select: { id: true, brand_name: true, website_url: true, tenant_id: true },
    });
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);

    this.logger.log(`Generating gap report for client ${clientId} (${client.brand_name})`);

    // Competitor data + client site crawled in parallel where possible
    const { topCompetitor, competitorUrls } = await this.findTopCompetitor(clientId);

    const [competitorPages, clientPages] = await Promise.all([
      this.crawlCompetitorUrls(competitorUrls),
      this.crawler.crawlSite(client.website_url, 10),
    ]);

    const competitorProfile = this.crawler.buildSiteProfile(competitorPages);
    const clientProfile = this.crawler.buildSiteProfile(clientPages);

    const { onSiteGaps, offSiteGaps, recommendedActions } = this.diff.computeGaps(
      clientProfile,
      competitorProfile,
    );

    const plainEnglishSummary = await this.summary.generateSummary({
      clientName: client.brand_name,
      clientWebsite: client.website_url,
      competitorDomain: topCompetitor?.domain ?? 'N/A',
      onSiteGaps,
      offSiteGaps,
      recommendedActions,
      clientProfile,
      competitorProfile,
    });

    const { version, previousReportId } = await this.getNextVersion(clientId);

    // Upsert citation sources and create report concurrently
    const [report] = await Promise.all([
      this.prisma.gapReport.create({
        data: {
          client_id: clientId,
          version,
          generated_at: new Date(),
          on_site_gaps: onSiteGaps as object,
          off_site_gaps: offSiteGaps as object,
          top_cited_competitor_id: topCompetitor?.id ?? null,
          top_cited_domain: topCompetitor?.domain ?? null,
          plain_english_summary: plainEnglishSummary,
          recommended_actions: recommendedActions as unknown as object[],
          previous_report_id: previousReportId,
        },
      }),
      this.upsertCitationSources(competitorPages),
    ]);

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

  private async getNextVersion(
    clientId: string,
  ): Promise<{ version: number; previousReportId: string | null }> {
    const latest = await this.prisma.gapReport.findFirst({
      where: { client_id: clientId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    return {
      version: (latest?.version ?? 0) + 1,
      previousReportId: latest?.id ?? null,
    };
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
