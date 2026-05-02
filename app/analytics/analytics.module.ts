import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaModule } from '../prisma/prisma.module';
import { AEO_ANALYTICS_REDIS } from './analytics.constants';
import { AnalyticsCitationService } from './analytics-citation.service';
import { AnalyticsSovService } from './analytics-sov.service';
import { AnalyticsAnomalyService } from './analytics-anomaly.service';
import { AnalyticsDashboardService } from './analytics-dashboard.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsCitationService,
    AnalyticsSovService,
    AnalyticsAnomalyService,
    AnalyticsDashboardService,
    {
      provide: AEO_ANALYTICS_REDIS,
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
    },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
