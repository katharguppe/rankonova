import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { AEO_ANALYTICS_REDIS } from './analytics.constants';

export interface SentimentAnalysis {
  overall: { positive: number; negative: number; neutral: number; mixed: number };
  trend: Array<{ date: string; positive: number; negative: number; neutral: number; mixed: number }>;
  snippets: Array<{ text: string; sentiment: string; brand_name: string }>;
}

export interface PromptAnalysis {
  prompt_id: string;
  text: string;
  intent_type: string;
  citation_rate: number;
  run_count: number;
}

export interface EngineBreakdown {
  engine: string;
  citation_rate: number;
  run_count: number;
  cited_runs: number;
}

export interface CitationSource {
  url: string;
  domain: string;
  mention_count: number;
}

export interface GeoBreakdown {
  city: string;
  state: string;
  citation_rate: number;
}

const TTL = 3600;

@Injectable()
export class AnalyticsDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AEO_ANALYTICS_REDIS) private readonly redis: Redis,
  ) {}

  async getSentiment(clientId: string): Promise<SentimentAnalysis> {
    const cached = await this.redis.get(`analytics:${clientId}:sentiment`);
    if (cached) return JSON.parse(cached) as SentimentAnalysis;

    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [overallRows, trendRows, snippetRows] = await Promise.all([
      this.prisma.$queryRaw<{ positive: string; negative: string; neutral: string; mixed: string }[]>`
        SELECT
          SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END)::text AS positive,
          SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END)::text AS negative,
          SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END)::text AS neutral,
          SUM(CASE WHEN sentiment = 'mixed' THEN 1 ELSE 0 END)::text AS mixed
        FROM brand_mentions
        WHERE client_id = ${clientId}
          AND is_client_brand = true
          AND created_at >= ${cutoff}
      `,
      this.prisma.$queryRaw<{ date: string; positive: string; negative: string; neutral: string; mixed: string }[]>`
        SELECT
          DATE(created_at)::text AS date,
          SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END)::text AS positive,
          SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END)::text AS negative,
          SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END)::text AS neutral,
          SUM(CASE WHEN sentiment = 'mixed' THEN 1 ELSE 0 END)::text AS mixed
        FROM brand_mentions
        WHERE client_id = ${clientId}
          AND is_client_brand = true
          AND created_at >= ${cutoff}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      this.prisma.$queryRaw<{ text: string; sentiment: string; brand_name: string }[]>`
        SELECT context_snippet AS text, sentiment::text AS sentiment, brand_name
        FROM brand_mentions
        WHERE client_id = ${clientId}
          AND is_client_brand = true
          AND context_snippet IS NOT NULL
          AND created_at >= ${cutoff}
        ORDER BY created_at DESC
        LIMIT 5
      `,
    ]);

    const o = overallRows[0] ?? { positive: '0', negative: '0', neutral: '0', mixed: '0' };
    const result: SentimentAnalysis = {
      overall: {
        positive: parseInt(o.positive ?? '0', 10),
        negative: parseInt(o.negative ?? '0', 10),
        neutral: parseInt(o.neutral ?? '0', 10),
        mixed: parseInt(o.mixed ?? '0', 10),
      },
      trend: trendRows.map(r => ({
        date: r.date,
        positive: parseInt(r.positive, 10),
        negative: parseInt(r.negative, 10),
        neutral: parseInt(r.neutral, 10),
        mixed: parseInt(r.mixed, 10),
      })),
      snippets: snippetRows.map(r => ({ text: r.text, sentiment: r.sentiment, brand_name: r.brand_name })),
    };

    await this.redis.setex(`analytics:${clientId}:sentiment`, TTL, JSON.stringify(result));
    return result;
  }

  async getPrompts(clientId: string): Promise<PromptAnalysis[]> {
    const cached = await this.redis.get(`analytics:${clientId}:prompts`);
    if (cached) return JSON.parse(cached) as PromptAnalysis[];

    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const rows = await this.prisma.$queryRaw<{
      prompt_id: string;
      text: string;
      intent_type: string;
      total_runs: string;
      cited_runs: string;
    }[]>`
      SELECT
        pr.prompt_id,
        p.text,
        p.intent_type::text AS intent_type,
        COUNT(DISTINCT pr.id)::text AS total_runs,
        COUNT(DISTINCT bm.run_id)::text AS cited_runs
      FROM prompt_runs pr
      JOIN prompts p ON p.id = pr.prompt_id
      LEFT JOIN brand_mentions bm ON bm.run_id = pr.id AND bm.is_client_brand = true
      WHERE pr.client_id = ${clientId}
        AND pr.status = 'completed'
        AND pr.ran_at >= ${cutoff}
      GROUP BY pr.prompt_id, p.text, p.intent_type
      ORDER BY cited_runs DESC, total_runs DESC
    `;

    const result: PromptAnalysis[] = rows.map(r => {
      const total = parseInt(r.total_runs, 10);
      const cited = parseInt(r.cited_runs, 10);
      return {
        prompt_id: r.prompt_id,
        text: r.text,
        intent_type: r.intent_type,
        citation_rate: total === 0 ? 0 : Math.round((cited / total) * 10000) / 100,
        run_count: total,
      };
    });

    await this.redis.setex(`analytics:${clientId}:prompts`, TTL, JSON.stringify(result));
    return result;
  }

  async getEngines(clientId: string): Promise<EngineBreakdown[]> {
    const cached = await this.redis.get(`analytics:${clientId}:engines`);
    if (cached) return JSON.parse(cached) as EngineBreakdown[];

    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const rows = await this.prisma.$queryRaw<{
      engine: string;
      total_runs: string;
      cited_runs: string;
    }[]>`
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
      ORDER BY cited_runs DESC
    `;

    const result: EngineBreakdown[] = rows.map(r => {
      const total = parseInt(r.total_runs, 10);
      const cited = parseInt(r.cited_runs, 10);
      return {
        engine: r.engine,
        citation_rate: total === 0 ? 0 : Math.round((cited / total) * 10000) / 100,
        run_count: total,
        cited_runs: cited,
      };
    });

    await this.redis.setex(`analytics:${clientId}:engines`, TTL, JSON.stringify(result));
    return result;
  }

  async getSources(clientId: string): Promise<CitationSource[]> {
    const cached = await this.redis.get(`analytics:${clientId}:sources`);
    if (cached) return JSON.parse(cached) as CitationSource[];

    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const rows = await this.prisma.$queryRaw<{ url: string; mention_count: string }[]>`
      SELECT
        bm.cited_url AS url,
        COUNT(*)::text AS mention_count
      FROM brand_mentions bm
      JOIN prompt_runs pr ON pr.id = bm.run_id
      WHERE bm.client_id = ${clientId}
        AND bm.cited_url IS NOT NULL
        AND pr.status = 'completed'
        AND pr.ran_at >= ${cutoff}
      GROUP BY bm.cited_url
      ORDER BY mention_count DESC
      LIMIT 20
    `;

    const result: CitationSource[] = rows.map(r => ({
      url: r.url,
      domain: this.extractDomain(r.url),
      mention_count: parseInt(r.mention_count, 10),
    }));

    await this.redis.setex(`analytics:${clientId}:sources`, TTL, JSON.stringify(result));
    return result;
  }

  async getGeo(clientId: string): Promise<GeoBreakdown[]> {
    const cached = await this.redis.get(`analytics:${clientId}:geo`);
    if (cached) return JSON.parse(cached) as GeoBreakdown[];

    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const rows = await this.prisma.$queryRaw<{
      city: string;
      state: string;
      total_runs: string;
      cited_runs: string;
    }[]>`
      SELECT
        c.city,
        c.state,
        COUNT(DISTINCT pr.id)::text AS total_runs,
        COUNT(DISTINCT bm.run_id)::text AS cited_runs
      FROM clients c
      JOIN prompt_runs pr ON pr.client_id = c.id
      LEFT JOIN brand_mentions bm ON bm.run_id = pr.id AND bm.is_client_brand = true
      WHERE c.id = ${clientId}
        AND pr.status = 'completed'
        AND pr.ran_at >= ${cutoff}
      GROUP BY c.city, c.state
    `;

    const result: GeoBreakdown[] = rows.map(r => {
      const total = parseInt(r.total_runs, 10);
      const cited = parseInt(r.cited_runs, 10);
      return {
        city: r.city,
        state: r.state,
        citation_rate: total === 0 ? 0 : Math.round((cited / total) * 10000) / 100,
      };
    });

    await this.redis.setex(`analytics:${clientId}:geo`, TTL, JSON.stringify(result));
    return result;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
}
