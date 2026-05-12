import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WeeklyBriefService } from './weekly-brief.service';
import { WeeklyBriefController } from './weekly-brief.controller';
import { CitationCalculator } from './helpers/citation-calculator';
import { ActionRanker } from './helpers/action-ranker';
import { BriefGenerator } from './helpers/brief-generator';
import { EmailSender } from './helpers/email-sender';
import { NotificationTrigger } from './helpers/notification-trigger';
import { DownstreamTrigger } from './helpers/downstream-trigger';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [WeeklyBriefController],
  providers: [
    WeeklyBriefService,
    CitationCalculator,
    ActionRanker,
    BriefGenerator,
    EmailSender,
    NotificationTrigger,
    DownstreamTrigger,
    PrismaService,
  ],
  exports: [WeeklyBriefService],
})
export class WeeklyBriefModule {}
