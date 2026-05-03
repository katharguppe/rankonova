import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { DiagnosticsCrawlerService } from './diagnostics-crawler.service';
import { DiagnosticsDiffService } from './diagnostics-diff.service';
import { DiagnosticsSummaryService } from './diagnostics-summary.service';

@Module({
  controllers: [DiagnosticsController],
  providers: [
    DiagnosticsService,
    DiagnosticsCrawlerService,
    DiagnosticsDiffService,
    DiagnosticsSummaryService,
  ],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
