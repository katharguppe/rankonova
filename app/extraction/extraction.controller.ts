import { Controller, Post, Param, HttpCode } from '@nestjs/common';
import { ExtractionService } from './extraction.service';

@Controller('extraction')
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}

  // Debug: manually trigger extraction for a known completed run_id
  @Post('trigger/:runId')
  @HttpCode(200)
  async trigger(@Param('runId') runId: string) {
    const count = await this.extractionService.runForPromptRun(runId);
    return { run_id: runId, brand_mentions_written: count };
  }
}
