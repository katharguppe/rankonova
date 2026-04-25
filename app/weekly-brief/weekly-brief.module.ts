import { Module } from '@nestjs/common';
import { WeeklyBriefController } from './weekly-brief.controller';
import { WeeklyBriefService } from './weekly-brief.service';

@Module({
  controllers: [WeeklyBriefController],
  providers: [WeeklyBriefService],
  exports: [WeeklyBriefService],
})
export class WeeklyBriefModule {}
