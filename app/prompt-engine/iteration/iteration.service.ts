import { Inject, Injectable, Logger } from '@nestjs/common';
import { PromptIteration } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { PE_REDIS } from '../prompt-engine.constants';

const COUNTER_TTL = 7200; // 2 hours

@Injectable()
export class IterationService {
  private readonly logger = new Logger(IterationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PE_REDIS) private readonly redis: Redis,
  ) {}

  async create(clientId: string): Promise<PromptIteration> {
    const agg = await this.prisma.promptIteration.aggregate({
      where: { client_id: clientId },
      _max: { iteration_number: true },
    });
    const next = (agg._max.iteration_number ?? 0) + 1;

    return this.prisma.promptIteration.create({
      data: { client_id: clientId, iteration_number: next, status: 'running' },
    });
  }

  async setCounter(clientId: string, iterationId: string, total: number): Promise<void> {
    await this.redis.set(`iteration:${clientId}:current`, iterationId, 'EX', COUNTER_TTL);
    await this.redis.set(`iteration:${clientId}:remaining`, total, 'EX', COUNTER_TTL);
  }

  async tick(clientId: string, iterationId: string): Promise<void> {
    const remaining = await this.redis.decr(`iteration:${clientId}:remaining`);
    if (remaining <= 0) {
      await this.complete(iterationId, clientId);
    }
  }

  async complete(iterationId: string, clientId: string): Promise<void> {
    await this.prisma.promptIteration.update({
      where: { id: iterationId },
      data: { status: 'completed', completed_at: new Date() },
    });

    await this.redis.del(
      `iteration:${clientId}:current`,
      `iteration:${clientId}:remaining`,
    );

    const port = process.env['PORT'] ?? 3000;
    fetch(`http://localhost:${port}/agent-reco/${iterationId}`, { method: 'POST' })
      .catch((err: Error) =>
        this.logger.warn(`agent-reco POST failed for ${iterationId}: ${err.message}`),
      );
  }
}
