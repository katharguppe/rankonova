import { Logger } from '@nestjs/common';
import { NotImplementedException } from '@nestjs/common';
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bull';
import { PromptRunStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../../prompts/quota.service';
import { EngineAdapterFactory } from '../engine-adapter.factory';
import { EngineRateLimiterService } from '../rate-limiter/engine-rate-limiter.service';
import { CostTrackerService } from '../cost/cost-tracker.service';
import { PROMPT_RUNS_QUEUE } from '../prompt-engine.constants';
import { PromptRunJobPayload } from '../prompt-engine.types';

function substituteTokens(text: string, city: string, brand: string, model: string): string {
  return text
    .replace(/\{city\}/g, city)
    .replace(/\{brand\}/g, brand)
    .replace(/\{model\}/g, model);
}

@Processor(PROMPT_RUNS_QUEUE)
export class PromptRunWorker {
  private readonly logger = new Logger(PromptRunWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterFactory: EngineAdapterFactory,
    private readonly rateLimiter: EngineRateLimiterService,
    private readonly costTracker: CostTrackerService,
    private readonly quotaService: QuotaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Process({ name: 'run-prompt', concurrency: 1 })
  async process(job: Job<PromptRunJobPayload>): Promise<void> {
    const { promptRunId, promptId, clientId, tenantId, engine } = job.data;

    // Mark as running immediately so status is never stuck at pending across retries
    await this.prisma.promptRun.update({
      where: { id: promptRunId },
      data: { status: PromptRunStatus.running, retry_count: job.attemptsMade },
    });

    const [prompt, client, tenant] = await Promise.all([
      this.prisma.prompt.findUnique({ where: { id: promptId } }),
      this.prisma.client.findFirst({
        where: { id: clientId, tenant_id: tenantId, is_active: true, deleted_at: null },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan_tier: true },
      }),
    ]);

    if (!prompt || !client || !tenant) {
      await this.prisma.promptRun.update({
        where: { id: promptRunId },
        data: { status: PromptRunStatus.failed, error_message: 'Prompt, client, or tenant not found' },
      });
      return; // Non-retriable — entity deleted; return without throw
    }

    const quotaStatus = await this.quotaService.check(tenantId, tenant.plan_tier);
    if (!quotaStatus.allowed) {
      await this.prisma.promptRun.update({
        where: { id: promptRunId },
        data: { status: PromptRunStatus.failed, error_message: 'Daily prompt quota exceeded' },
      });
      return; // Non-retriable — quota enforced at daily boundary
    }

    const aliases = client.aliases as string[];
    const model = aliases[0] ?? client.brand_name;
    const promptText = substituteTokens(prompt.text, client.city, client.brand_name, model);

    const start = Date.now();

    try {
      const allowed = await this.rateLimiter.tryAcquire(engine);
      if (!allowed) {
        throw new Error(`Rate limit exceeded for engine ${engine} — will retry`);
      }

      const adapter = this.adapterFactory.get(engine);
      const result = await adapter.execute(promptText);
      const durationMs = Date.now() - start;

      await this.prisma.promptRun.update({
        where: { id: promptRunId },
        data: {
          status: PromptRunStatus.completed,
          raw_response: result.text,
          tokens_used: result.inputTokens + result.outputTokens,
          duration_ms: durationMs,
          cost_usd: result.costUsd,
          retry_count: job.attemptsMade,
        },
      });

      await Promise.all([
        this.quotaService.increment(tenantId),
        this.costTracker.incrementCost(tenantId, result.costUsd),
      ]);

      this.eventEmitter.emit('extraction.requested', { promptRunId, clientId, tenantId });
    } catch (err) {
      if (err instanceof NotImplementedException) {
        // Engine not available — fail immediately, no retry
        await this.prisma.promptRun.update({
          where: { id: promptRunId },
          data: {
            status: PromptRunStatus.failed,
            error_message: (err as Error).message,
            duration_ms: Date.now() - start,
          },
        });
        return;
      }
      // Retriable error (rate limit, API timeout, etc.) — update for audit, then rethrow
      await this.prisma.promptRun.update({
        where: { id: promptRunId },
        data: { error_message: (err as Error).message, retry_count: job.attemptsMade },
      });
      throw err;
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job<PromptRunJobPayload>, error: Error): Promise<void> {
    const attemptsConfig = job.opts.attempts ?? 3;
    if (job.attemptsMade < attemptsConfig) return; // More retries coming

    const { promptRunId, engine } = job.data;
    this.logger.error(`[DLQ] ${promptRunId} on ${engine} after ${job.attemptsMade} attempts: ${error.message}`);

    await this.prisma.promptRun.update({
      where: { id: promptRunId },
      data: {
        status: PromptRunStatus.dead_letter,
        error_message: error.message,
        retry_count: job.attemptsMade,
      },
    });
    // TODO: trigger super_admin notification when NotificationsModule ships
  }
}
