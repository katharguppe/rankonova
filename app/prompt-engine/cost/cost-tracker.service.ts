import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PE_REDIS } from '../prompt-engine.constants';

@Injectable()
export class CostTrackerService {
  constructor(@Inject(PE_REDIS) private readonly redis: Redis) {}

  async incrementCost(tenantId: string, costUsd: number): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    const key = `cost:${tenantId}:${date}`;
    // Store as micro-dollars (integers) to avoid float arithmetic errors
    const microDollars = Math.round(costUsd * 1_000_000);
    if (microDollars <= 0) return;
    const val = await this.redis.incrby(key, microDollars);
    if (val === microDollars) {
      await this.redis.expire(key, 48 * 60 * 60);
    }
  }

  async getDailyCostUsd(tenantId: string, date?: string): Promise<number> {
    const d = date ?? new Date().toISOString().slice(0, 10);
    const raw = await this.redis.get(`cost:${tenantId}:${d}`);
    return raw ? parseInt(raw, 10) / 1_000_000 : 0;
  }
}
