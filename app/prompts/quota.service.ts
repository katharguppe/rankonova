import { Inject, Injectable } from '@nestjs/common';
import { PlanTier } from '@prisma/client';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const QUOTA_LIMITS: Record<PlanTier, number> = {
  [PlanTier.starter]: 500,
  [PlanTier.growth]: 5000,
  [PlanTier.enterprise]: Infinity,
};

export interface QuotaStatus {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: Date;
}

@Injectable()
export class QuotaService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(tenantId: string): string {
    const date = new Date().toISOString().slice(0, 10);
    return `quota:${tenantId}:${date}`;
  }

  private nextMidnightUtc(): Date {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d;
  }

  async check(tenantId: string, planTier: PlanTier): Promise<QuotaStatus> {
    const limit = QUOTA_LIMITS[planTier];
    const resetAt = this.nextMidnightUtc();

    if (limit === Infinity) {
      return { allowed: true, count: 0, limit, resetAt };
    }

    const raw = await this.redis.get(this.key(tenantId));
    const count = raw ? parseInt(raw, 10) : 0;
    return { allowed: count < limit, count, limit, resetAt };
  }

  async increment(tenantId: string): Promise<number> {
    const k = this.key(tenantId);
    const count = await this.redis.incr(k);
    if (count === 1) {
      await this.redis.expire(k, 48 * 60 * 60);
    }
    return count;
  }
}
