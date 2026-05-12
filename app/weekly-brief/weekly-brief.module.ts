import { Module } from '@nestjs/common';
import { WeeklyBriefController } from './weekly-brief.controller';
import { WeeklyBriefService } from './weekly-brief.service';
import { CitationCalculator } from './helpers/citation-calculator';
import { ActionRanker } from './helpers/action-ranker';
import { BriefGenerator } from './helpers/brief-generator';
import { EmailSender } from './helpers/email-sender';
import { NotificationTrigger } from './helpers/notification-trigger';
import { DownstreamTrigger } from './helpers/downstream-trigger';

@Module({
  controllers: [WeeklyBriefController],
  providers: [
    WeeklyBriefService,
    CitationCalculator,
    ActionRanker,
    BriefGenerator,
    EmailSender,
    NotificationTrigger,
    DownstreamTrigger,
  ],
  exports: [WeeklyBriefService],
})
export class WeeklyBriefModule {}
