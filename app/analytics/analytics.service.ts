import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsCitationService, CitationOverview } from './analytics-citation.service';
import { AnalyticsSovService, SovEntry } from './analytics-sov.service';
import { AnalyticsAnomalyService } from './analytics-anomaly.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly citation: AnalyticsCitationService,
    private readonly sov: AnalyticsSovService,
    private readonly anomaly: AnalyticsAnomalyService,
  ) {}

  async getCitationOverview(clientId: string): Promise<CitationOverview> {
    return this.citation.getCitationOverview(clientId);
  }

  async getShareOfVoice(clientId: string): Promise<SovEntry[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { tenant_id: true },
    });
    if (!client) return [];
    return this.sov.getShareOfVoice(clientId, client.tenant_id);
  }

  async detectAnomalies(clientId: string, tenantId: string): Promise<void> {
    return this.anomaly.detectAnomalies(clientId, tenantId);
  }
}
