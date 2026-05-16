import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiEngine } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RequestUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { PromptRunQueueService } from './queue/prompt-run.queue';
import { CostTrackerService } from './cost/cost-tracker.service';
import { TriggerRunDto } from './dto/trigger-run.dto';

const DEFAULT_ENGINES: AiEngine[] = [
  AiEngine.chatgpt,
  AiEngine.perplexity,
  AiEngine.gemini,
  AiEngine.claude,
  AiEngine.cerebras,
];

@Injectable()
export class PromptEngineService {
  private readonly logger = new Logger(PromptEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: PromptRunQueueService,
    private readonly costTracker: CostTrackerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async triggerClientRun(clientId: string, user: RequestUser): Promise<{ enqueued: number; runIds: string[] }> {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        is_active: true,
        deleted_at: null,
        ...(user.role !== 'super_admin' ? { tenant_id: user.tenantId } : {}),
      },
    });
    if (!client) throw new NotFoundException('Client not found');

    const prompts = await this.prisma.prompt.findMany({
      where: {
        vertical_id: client.vertical_id,
        is_active: true,
        OR: [{ tenant_id: null }, { tenant_id: client.tenant_id }],
      },
      select: { id: true },
    });

    const allRunIds: string[] = [];
    for (const prompt of prompts) {
      const runIds = await this.queue.enqueue(prompt.id, clientId, client.tenant_id, DEFAULT_ENGINES);
      allRunIds.push(...runIds);
    }

    // Check failure rate and emit alert if needed
    await this.checkFailureRate(clientId, client.tenant_id);

    return { enqueued: allRunIds.length, runIds: allRunIds };
  }

  async triggerRun(dto: TriggerRunDto, user: RequestUser): Promise<{ runIds: string[] }> {
    const client = await this.prisma.client.findFirst({
      where: {
        id: dto.clientId,
        is_active: true,
        deleted_at: null,
        ...(user.role !== 'super_admin' ? { tenant_id: user.tenantId } : {}),
      },
    });
    if (!client) throw new NotFoundException('Client not found');

    const prompt = await this.prisma.prompt.findFirst({
      where: { id: dto.promptId, is_active: true },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');

    const engines = dto.engines ?? DEFAULT_ENGINES;
    const runIds = await this.queue.enqueue(dto.promptId, dto.clientId, client.tenant_id, engines);
    return { runIds };
  }

  async getRunStatus(runId: string, user: RequestUser) {
    const run = await this.prisma.promptRun.findUnique({
      where: { id: runId },
      include: { client: { select: { tenant_id: true } } },
    });
    if (!run) throw new NotFoundException('PromptRun not found');

    if (user.role !== 'super_admin' && run.client.tenant_id !== user.tenantId) {
      throw new ForbiddenException();
    }
    return run;
  }

  async getQueueStats(user: RequestUser) {
    if (user.role !== 'super_admin') throw new ForbiddenException();
    return this.queue.getQueueStats();
  }

  async flushWaiting(user: RequestUser) {
    return this.queue.flushWaiting();
  }

  async getDailyCost(user: RequestUser, date?: string) {
    const tenantId = user.role === 'super_admin' ? user.tenantId : user.tenantId;
    return { costUsd: await this.costTracker.getDailyCostUsd(tenantId, date) };
  }

  private async checkFailureRate(clientId: string, tenantId: string): Promise<void> {
    // Check failure rate in the past hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [totalCount, failureCount] = await Promise.all([
      this.prisma.promptRun.count({
        where: {
          client_id: clientId,
          ran_at: { gte: oneHourAgo },
        },
      }),
      this.prisma.promptRun.count({
        where: {
          client_id: clientId,
          ran_at: { gte: oneHourAgo },
          status: 'failed',
        },
      }),
    ]);

    if (totalCount < 10) return; // Only check if we have sufficient samples

    const failurePercentage = (failureCount / totalCount) * 100;
    if (failurePercentage > 20) {
      this.eventEmitter.emit('prompt.failure.rate', {
        clientId,
        tenantId,
        failurePercentage: Math.round(failurePercentage),
        failureCount,
        totalCount,
        timestamp: new Date(),
      });
      this.logger.warn(
        `Prompt failure rate alert: clientId=${clientId}, failurePercentage=${failurePercentage.toFixed(1)}%`,
      );
    }
  }
}
