import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { AEO_ANALYTICS_REDIS } from './analytics.constants';

export interface CitationOverview {
  windows: { '7d': number; '30d': number; '90d': number };
  byEngine: Record<string, number>;
  byIntent: Record<string, number>;
}

const TTL = 3600;

@Injectable()
export class AnalyticsCitationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AEO_ANALYTICS_REDIS) private readonly redis: Redis,
  ) {}

  async getCitationOverview(clientId: string): Promise<CitationOverview> {
    const cached = await this.redis.get(`citation:${clientId}:overview`);
    if (cached) return JSON.parse(cached) as CitationOverview;

    const [w7, w30, w90, byEngine, byIntent] = await Promise.all([
      this.computeWindowRate(clientId, 7),
      this.computeWindowRate(clientId, 30),
      this.computeWindowRate(clientId, 90),
      this.computeByEngine(clientId, 30),
      this.computeByIntent(clientId, 30),
    ]);

    const overview: CitationOverview = {
      windows: { '7d': w7, '30d': w30, '90d': w90 },
      byEngine,
      byIntent,
    };
    this.redis.setex(`citation:${clientId}:overview`, TTL, JSON.stringify(overview)).catch(() => undefined);
    return overview;
  }

  async getRate24h(clientId: string): Promise<number> {
    const cached = await this.redis.get(`citation:${clientId}:24h`);
    if (cached !== null) return parseFloat(cached);

    const rate = await this.computeRateInHourRange(clientId, 24, 0);
    this.redis.setex(`citation:${clientId}:24h`, TTL, rate.toString()).catch(() => undefined);
    return rate;
  }

  async getPrevRate24h(clientId: string): Promise<number | null> {
    const cached = await this.redis.get(`citation:${clientId}:24h:prev`);
    if (cached !== null) return parseFloat(cached);

    const rate = await this.computeRateInHourRange(clientId, 48, 24);
    this.redis.setex(`citation:${clientId}:24h:prev`, TTL, rate.toString()).catch(() => undefined);
    return rate;
  }

  async getCompetitorRate24h(clientId: string, competitorId: string): Promise<number> {
    const cached = await this.redis.get(`citation:${clientId}:comp:${competitorId}:24h`);
    if (cached !== null) return parseFloat(cached);

    const rate = await this.computeCompetitorRateInHourRange(clientId, competitorId, 24, 0);
    this.redis.setex(`citation:${clientId}:comp:${competitorId}:24h`, TTL, rate.toString()).catch(() => undefined);
    return rate;
  }

  async getCompetitorPrevRate24h(clientId: string, competitorId: string): Promise<number | null> {
    const cached = await this.redis.get(`citation:${clientId}:comp:${competitorId}:24h:prev`);
    if (cached !== null) return parseFloat(cached);

    const rate = await this.computeCompetitorRateInHourRange(clientId, competitorId, 48, 24);
    this.redis.setex(`citation:${clientId}:comp:${competitorId}:24h:prev`, TTL, rate.toString()).catch(() => undefined);
    return rate;
  }

  async invalidateClientCache(clientId: string): Promise<void> {
    await this.redis
      .del(
        `citation:${clientId}:overview`,
        `citation:${clientId}:24h`,
        `citation:${clientId}:24h:prev`,
      )
      .catch(() => undefined);
  }

  async computeWindowRate(clientId: string, days: number): Promise<number> {
    return this.computeRateInHourRange(clientId, days * 24, 0);
  }

  async computeCompetitorWindowRate(clientId: string, competitorId: string, days: number): Promise<number> {
    return this.computeCompetitorRateInHourRange(clientId, competitorId, days * 24, 0);
  }

  private async computeRateInHourRange(
    clientId: string,
    fromHoursAgo: number,
    toHoursAgo: number,
  ): Promise<number> {
    const now = Date.now();
    const from = new Date(now - fromHoursAgo * 3600 * 1000);
    const to = toHoursAgo === 0 ? null : new Date(now - toHoursAgo * 3600 * 1000);

    const rows = to
      ? await this.prisma.$queryRaw<{ total_runs: string; cited_runs: string }[]>`
          SELECT
            COUNT(DISTINCT pr.id)::text AS total_runs,
            COUNT(DISTINCT bm.run_id)::text AS cited_runs
          FROM prompt_runs pr
          LEFT JOIN brand_mentions bm ON bm.run_id = pr.id AND bm.is_client_brand = true
          WHERE pr.client_id = ${clientId}
            AND pr.status = 'completed'
            AND pr.ran_at >= ${from}
            AND pr.ran_at < ${to}
        `
      : await this.prisma.$queryRaw<{ total_runs: string; cited_runs: string }[]>`
          SELECT
            COUNT(DISTINCT pr.id)::text AS total_runs,
            COUNT(DISTINCT bm.run_id)::text AS cited_runs
          FROM prompt_runs pr
          LEFT JOIN brand_mentions bm ON bm.run_id = pr.id AND bm.is_client_brand = true
          WHERE pr.client_id = ${clientId}
            AND pr.status = 'completed'
            AND pr.ran_at >= ${from}
        `;

    return this.toRate(rows[0]);
  }

  private async computeCompetitorRateInHourRange(
    clientId: string,
    competitorId: string,
    fromHoursAgo: number,
    toHoursAgo: number,
  ): Promise<number> {
    const now = Date.now();
    const from = new Date(now - fromHoursAgo * 3600 * 1000);
    const to = toHoursAgo === 0 ? null : new Date(now - toHoursAgo * 3600 * 1000);

    const [totalRows, citedRows] = to
      ? await Promise.all([
          this.prisma.$queryRaw<{ count: string }[]>`
            SELECT COUNT(DISTINCT id)::text AS count
            FROM prompt_runs
            WHERE client_id = ${clientId}
              AND status = 'completed'
              AND ran_at >= ${from}
              AND ran_at < ${to}
          `,
          this.prisma.$queryRaw<{ count: string }[]>`
            SELECT COUNT(DISTINCT bm.run_id)::text AS count
            FROM brand_mentions bm
            JOIN prompt_runs pr ON pr.id = bm.run_id
            WHERE bm.client_id = ${clientId}
              AND bm.competitor_id = ${competitorId}
              AND pr.status = 'completed'
              AND pr.ran_at >= ${from}
              AND pr.ran_at < ${to}
          `,
        ])
      : await Promise.all([
          this.prisma.$queryRaw<{ count: string }[]>`
            SELECT COUNT(DISTINCT id)::text AS count
            FROM prompt_runs
            WHERE client_id = ${clientId}
              AND status = 'completed'
              AND ran_at >= ${from}
          `,
          this.prisma.$queryRaw<{ count: string }[]>`
            SELECT COUNT(DISTINCT bm.run_id)::text AS count
            FROM brand_mentions bm
            JOIN prompt_runs pr ON pr.id = bm.run_id
            WHERE bm.client_id = ${clientId}
              AND bm.competitor_id = ${competitorId}
              AND pr.status = 'completed'
              AND pr.ran_at >= ${from}
          `,
        ]);

    const total = parseInt(totalRows[0]?.count ?? '0', 10);
    const cited = parseInt(citedRows[0]?.count ?? '0', 10);
    return total === 0 ? 0 : Math.round((cited / total) * 10000) / 100;
  }

  private async computeByEngine(clientId: string, days: number): Promise<Record<string, number>> {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await this.prisma.$queryRaw<{ engine: string; total_runs: string; cited_runs: string }[]>`
      SELECT
        pr.engine::text AS engine,
        COUNT(DISTINCT pr.id)::text AS total_runs,
        COUNT(DISTINCT bm.run_id)::text AS cited_runs
      FROM prompt_runs pr
      LEFT JOIN brand_mentions bm ON bm.run_id = pr.id AND bm.is_client_brand = true
      WHERE pr.client_id = ${clientId}
        AND pr.status = 'completed'
        AND pr.ran_at >= ${cutoff}
      GROUP BY pr.engine
    `;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.engine] = this.toRate(row);
    }
    return result;
  }

  private async computeByIntent(clientId: string, days: number): Promise<Record<string, number>> {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await this.prisma.$queryRaw<{ intent_type: string; total_runs: string; cited_runs: string }[]>`
      SELECT
        p.intent_type::text AS intent_type,
        COUNT(DISTINCT pr.id)::text AS total_runs,
        COUNT(DISTINCT bm.run_id)::text AS cited_runs
      FROM prompt_runs pr
      JOIN prompts p ON p.id = pr.prompt_id
      LEFT JOIN brand_mentions bm ON bm.run_id = pr.id AND bm.is_client_brand = true
      WHERE pr.client_id = ${clientId}
        AND pr.status = 'completed'
        AND pr.ran_at >= ${cutoff}
      GROUP BY p.intent_type
    `;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.intent_type] = this.toRate(row);
    }
    return result;
  }

  private toRate(row: { total_runs: string; cited_runs: string } | undefined): number {
    if (!row) return 0;
    const total = parseInt(row.total_runs, 10);
    const cited = parseInt(row.cited_runs, 10);
    return total === 0 ? 0 : Math.round((cited / total) * 10000) / 100;
  }
}
