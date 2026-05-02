import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { VerticalsModule } from './verticals/verticals.module';
import { ClientsModule } from './clients/clients.module';
import { CompetitorsModule } from './competitors/competitors.module';
import { PromptsModule } from './prompts/prompts.module';
import { PromptEngineModule } from './prompt-engine/prompt-engine.module';
import { ExtractionModule } from './extraction/extraction.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { ContentAgentModule } from './content-agent/content-agent.module';
import { OffsiteModule } from './offsite/offsite.module';
import { WeeklyBriefModule } from './weekly-brief/weekly-brief.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({ redis: process.env['REDIS_URL'] ?? 'redis://localhost:6379' }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    CommonModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    VerticalsModule,
    ClientsModule,
    CompetitorsModule,
    PromptsModule,
    PromptEngineModule,
    ExtractionModule,
    AnalyticsModule,
    DiagnosticsModule,
    ContentAgentModule,
    OffsiteModule,
    WeeklyBriefModule,
    BillingModule,
    NotificationsModule,
    AdminModule,
  ],
})
export class AppModule {}
