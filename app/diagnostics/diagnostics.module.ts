import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { DiagnosticsCrawlerService } from './diagnostics-crawler.service';

@Module({
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService, DiagnosticsCrawlerService],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
