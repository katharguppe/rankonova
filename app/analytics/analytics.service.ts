import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsCitationService, CitationOverview } from './analytics-citation.service';
import { AnalyticsSovService, SovEntry } from './analytics-sov.service';
import { AnalyticsAnomalyService } from './analytics-anomaly.service';
import {
  AnalyticsDashboardService,
  SentimentAnalysis,
  PromptAnalysis,
  EngineBreakdown,
  CitationSource,
  GeoBreakdown,
} from './analytics-dashboard.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly citation: AnalyticsCitationService,
    private readonly sov: AnalyticsSovService,
    private readonly anomaly: AnalyticsAnomalyService,
    private readonly dashboard: AnalyticsDashboardService,
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

  async getSentiment(clientId: string): Promise<SentimentAnalysis> {
    return this.dashboard.getSentiment(clientId);
  }

  async getPrompts(clientId: string): Promise<PromptAnalysis[]> {
    return this.dashboard.getPrompts(clientId);
  }

  async getEngines(clientId: string): Promise<EngineBreakdown[]> {
    return this.dashboard.getEngines(clientId);
  }

  async getSources(clientId: string): Promise<CitationSource[]> {
    return this.dashboard.getSources(clientId);
  }

  async getGeo(clientId: string): Promise<GeoBreakdown[]> {
    return this.dashboard.getGeo(clientId);
  }
}
