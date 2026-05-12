import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ContentAgentService } from '../../content-agent/content-agent.service';

@Injectable()
export class DownstreamTrigger {
  private readonly logger = new Logger(DownstreamTrigger.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentAgentService: ContentAgentService,
  ) {}

  async triggerGapReportIfNeeded(clientId: string, citationDelta: number): Promise<void> {
    if (citationDelta >= 0) return;

    try {
      this.logger.log(`Citation dropped for client ${clientId}; triggering GapReport generation`);
      // TODO: Call GapReport service when available
      // await this.gapReportService.generateForClient(clientId);
    } catch (err) {
      this.logger.error(`Failed to trigger GapReport: ${(err as Error).message}`);
    }
  }

  async triggerContentDraftsForWorstPrompts(clientId: string, tenantId: string): Promise<void> {
    try {
      // Find 3 prompts with lowest citation rate in past 30 days
      const worstPrompts = await this.prisma.$queryRaw<
        Array<{ prompt_id: string; citation_rate: number }>
      >`
        SELECT
          p.id AS prompt_id,
          COUNT(CASE WHEN bm.is_client_brand = true THEN 1 END) * 1.0 / COUNT(pr.id) AS citation_rate
        FROM prompts p
        JOIN prompt_runs pr ON p.id = pr.prompt_id
        LEFT JOIN brand_mentions bm ON pr.id = bm.run_id
        WHERE pr.client_id = ${clientId}
          AND pr.ran_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.id
        ORDER BY citation_rate ASC
        LIMIT 3
      `;

      const generatePromises = worstPrompts.map(({ prompt_id }) => {
        this.logger.log(`Triggering content draft for prompt ${prompt_id} (worst performer)`);
        return this.contentAgentService.generateContent(tenantId, {
          clientId,
          contentType: 'faq_page' as const,
          targetPromptId: prompt_id,
        });
      });

      const results = await Promise.allSettled(generatePromises);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const prompt_id = worstPrompts[index].prompt_id;
          this.logger.error(
            `Failed to generate content draft for prompt ${prompt_id}: ${result.reason.message}`,
          );
        } else {
          const prompt_id = worstPrompts[index].prompt_id;
          this.logger.log(
            `Content draft generated successfully for prompt ${prompt_id}, output ID: ${result.value.id}`,
          );
        }
      });
    } catch (err) {
      this.logger.error(`Failed to trigger content drafts: ${(err as Error).message}`);
    }
  }
}
