import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiEngine } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptRunQueueService } from '../queue/prompt-run.queue';
import { IterationService } from '../iteration/iteration.service';

// Engines available for scheduled runs (stubs excluded)
const SCHEDULED_ENGINES: AiEngine[] = [
  AiEngine.chatgpt,
  AiEngine.perplexity,
  AiEngine.gemini,
  AiEngine.claude,
  AiEngine.cerebras,
];

@Injectable()
export class PromptEngineScheduler {
  private readonly logger = new Logger(PromptEngineScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: PromptRunQueueService,
    private readonly iterationService: IterationService,
  ) {}

  // 2AM IST = UTC 20:30 previous calendar day
  @Cron('30 20 * * *')
  async runDailyBatch(): Promise<void> {
    this.logger.log('[Scheduler] Starting daily prompt batch');

    const clients = await this.prisma.client.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, tenant_id: true, vertical_id: true },
    });

    let enqueued = 0;

    // ── Platform prompts (unchanged) ──────────────────────────────────────
    for (const client of clients) {
      const prompts = await this.prisma.prompt.findMany({
        where: {
          vertical_id: client.vertical_id,
          is_active: true,
          OR: [{ tenant_id: null }, { tenant_id: client.tenant_id }],
        },
        select: { id: true },
      });

      for (const prompt of prompts) {
        await this.queue.enqueue(prompt.id, client.id, client.tenant_id, SCHEDULED_ENGINES);
        enqueued += SCHEDULED_ENGINES.length;
      }
    }

    this.logger.log(`[Scheduler] Enqueued ${enqueued} prompt runs across ${clients.length} clients`);

    // ── Agent prompts (iteration tracking) ───────────────────────────────
    let iterationsCreated = 0;

    for (const client of clients) {
      const agentPrompts = await this.prisma.prompt.findMany({
        where: {
          client_id: client.id,
          source: 'agent',
          is_active: true,
        },
        select: { id: true },
      });

      if (agentPrompts.length === 0) continue;

      const iteration = await this.iterationService.create(client.id);
      const promptIds = agentPrompts.map(p => p.id);
      const total = promptIds.length * SCHEDULED_ENGINES.length;

      await this.iterationService.setCounter(client.id, iteration.id, total);
      await this.queue.enqueueAgentBatch(
        client.id,
        client.tenant_id,
        promptIds,
        SCHEDULED_ENGINES,
        iteration.id,
      );

      iterationsCreated++;
      this.logger.log(
        `[Scheduler] Iteration ${iteration.iteration_number} created for client ${client.id} (${total} runs)`,
      );
    }

    this.logger.log(`[Scheduler] Created ${iterationsCreated} iterations`);
  }
}
