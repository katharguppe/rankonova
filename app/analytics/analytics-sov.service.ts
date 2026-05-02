import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsCitationService } from './analytics-citation.service';

export interface SovEntry {
  brand_name: string;
  is_client: boolean;
  citation_rate: number;
}

@Injectable()
export class AnalyticsSovService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly citation: AnalyticsCitationService,
  ) {}

  async getShareOfVoice(clientId: string, tenantId: string): Promise<SovEntry[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { brand_name: true, vertical_id: true },
    });
    if (!client) return [];

    const competitors = await this.prisma.competitor.findMany({
      where: { tenant_id: tenantId, vertical_id: client.vertical_id, is_active: true },
      select: { id: true, name: true },
    });

    const clientRate = await this.citation.computeWindowRate(clientId, 30);

    if (competitors.length === 0) {
      return [{ brand_name: client.brand_name, is_client: true, citation_rate: clientRate }];
    }

    const competitorIds = competitors.map(c => c.id);
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const totalResult = await this.prisma.$queryRaw<{ count: string }[]>`
      SELECT COUNT(DISTINCT id)::text AS count
      FROM prompt_runs
      WHERE client_id = ${clientId}
        AND status = 'completed'
        AND ran_at >= ${cutoff}
    `;
    const totalRuns = parseInt(totalResult[0]?.count ?? '0', 10);

    let competitorRates: { competitor_id: string; cited_runs: string }[] = [];
    if (totalRuns > 0) {
      competitorRates = await this.prisma.$queryRaw<{ competitor_id: string; cited_runs: string }[]>`
        SELECT
          bm.competitor_id,
          COUNT(DISTINCT bm.run_id)::text AS cited_runs
        FROM brand_mentions bm
        JOIN prompt_runs pr ON pr.id = bm.run_id
        WHERE bm.client_id = ${clientId}
          AND bm.competitor_id IN (${Prisma.join(competitorIds)})
          AND pr.status = 'completed'
          AND pr.ran_at >= ${cutoff}
        GROUP BY bm.competitor_id
      `;
    }

    const rateMap = new Map(competitorRates.map(r => [
      r.competitor_id,
      Math.round((parseInt(r.cited_runs, 10) / totalRuns) * 10000) / 100,
    ]));

    const entries: SovEntry[] = [
      { brand_name: client.brand_name, is_client: true, citation_rate: clientRate },
      ...competitors.map(c => ({
        brand_name: c.name,
        is_client: false,
        citation_rate: rateMap.get(c.id) ?? 0,
      })),
    ];

    return entries.sort((a, b) => b.citation_rate - a.citation_rate);
  }
}
