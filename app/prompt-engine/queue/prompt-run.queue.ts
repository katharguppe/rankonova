import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { AiEngine, PromptRunStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PROMPT_RUNS_QUEUE } from '../prompt-engine.constants';
import { PromptRunJobPayload } from '../prompt-engine.types';

const JOB_NAME = 'run-prompt';
const RETRY_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: 100, // keep last 100 completed jobs for BullBoard
  removeOnFail: 500,
};

@Injectable()
export class PromptRunQueueService {
  constructor(
    @InjectQueue(PROMPT_RUNS_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async enqueue(
    promptId: string,
    clientId: string,
    tenantId: string,
    engines: AiEngine[],
  ): Promise<string[]> {
    const runIds: string[] = [];

    for (const engine of engines) {
      const run = await this.prisma.promptRun.create({
        data: {
          prompt_id: promptId,
          client_id: clientId,
          engine,
          ran_at: new Date(),
          status: PromptRunStatus.pending,
        },
      });

      const payload: PromptRunJobPayload = {
        promptRunId: run.id,
        promptId,
        clientId,
        tenantId,
        engine,
      };

      await this.queue.add(JOB_NAME, payload, RETRY_OPTIONS);
      runIds.push(run.id);
    }

    return runIds;
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }
}
