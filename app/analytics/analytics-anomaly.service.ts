import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationSeverity } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { AEO_ANALYTICS_REDIS } from './analytics.constants';
import { AnalyticsCitationService } from './analytics-citation.service';

export interface CitationDropEvent {
  clientId: string;
  tenantId: string;
  delta: number;
}

const NOTIF_RL_TTL = 4 * 3600; // 4 hours
const DROP_THRESHOLD = -10;
const SPIKE_THRESHOLD = 15;

@Injectable()
export class AnalyticsAnomalyService {
  private readonly logger = new Logger(AnalyticsAnomalyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly citation: AnalyticsCitationService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(AEO_ANALYTICS_REDIS) private readonly redis: Redis,
  ) {}

  async detectAnomalies(clientId: string, tenantId: string): Promise<void> {
    await Promise.all([
      this.checkClientDrop(clientId, tenantId),
      this.checkCompetitorSpikes(clientId, tenantId),
    ]);
  }

  private async checkClientDrop(clientId: string, tenantId: string): Promise<void> {
    const [current, prev] = await Promise.all([
      this.citation.getRate24h(clientId),
      this.citation.getPrevRate24h(clientId),
    ]);

    if (prev === null) return;

    const delta = current - prev;
    if (delta >= DROP_THRESHOLD) return;

    const rateLimited = await this.setNotifRateLimit(clientId, 'citation_drop');
    if (rateLimited) return;

    await this.prisma.notification.create({
      data: {
        tenant_id: tenantId,
        client_id: clientId,
        type: 'citation_drop',
        severity: NotificationSeverity.critical,
        title: 'Citation Rate Drop Detected',
        body: `Citation rate dropped by ${Math.abs(delta).toFixed(1)} points in 24h (${prev.toFixed(1)}% → ${current.toFixed(1)}%).`,
        deep_link: `/analytics/${clientId}`,
      },
    });

    this.logger.warn(`[anomaly] citation_drop clientId=${clientId} delta=${delta.toFixed(1)}`);

    this.eventEmitter.emit('analytics.citation_drop', {
      clientId,
      tenantId,
      delta,
    } satisfies CitationDropEvent);
  }

  private async checkCompetitorSpikes(clientId: string, tenantId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { vertical_id: true },
    });
    if (!client) return;

    const competitors = await this.prisma.competitor.findMany({
      where: { tenant_id: tenantId, vertical_id: client.vertical_id, is_active: true },
      select: { id: true, name: true },
    });

    await Promise.all(
      competitors.map(comp => this.checkOneCompetitor(clientId, tenantId, comp.id, comp.name)),
    );
  }

  private async checkOneCompetitor(
    clientId: string,
    tenantId: string,
    competitorId: string,
    competitorName: string,
  ): Promise<void> {
    const [current, prev] = await Promise.all([
      this.citation.getCompetitorRate24h(clientId, competitorId),
      this.citation.getCompetitorPrevRate24h(clientId, competitorId),
    ]);

    if (prev === null) return;

    const delta = current - prev;
    if (delta <= SPIKE_THRESHOLD) return;

    const rateLimited = await this.setNotifRateLimit(clientId, `competitor_spike:${competitorId}`);
    if (rateLimited) return;

    await this.prisma.notification.create({
      data: {
        tenant_id: tenantId,
        client_id: clientId,
        type: 'competitor_spike',
        severity: NotificationSeverity.high,
        title: `Competitor Spike: ${competitorName}`,
        body: `${competitorName} citation rate jumped +${delta.toFixed(1)} points in 24h (${prev.toFixed(1)}% → ${current.toFixed(1)}%).`,
        deep_link: `/analytics/${clientId}/share-of-voice`,
      },
    });

    this.logger.warn(`[anomaly] competitor_spike clientId=${clientId} competitor=${competitorName} delta=+${delta.toFixed(1)}`);
  }

  private async setNotifRateLimit(clientId: string, type: string): Promise<boolean> {
    const key = `notif_rl:${clientId}:${type}`;
    const result = await this.redis.set(key, '1', 'EX', NOTIF_RL_TTL, 'NX');
    return result === null; // null = key already existed = rate limited
  }
}
