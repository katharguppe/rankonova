import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { NotificationSeverity, NotificationType, RateLimitCheckResult } from './notifications.types';

const RATE_LIMIT_WINDOW = 14400; // 4 hours in seconds

@Injectable()
export class RateLimiterService {
  constructor(@Inject('REDIS_CLIENT') private redis: Redis) {}

  async canSend(
    clientId: string,
    type: NotificationType,
    severity: NotificationSeverity,
  ): Promise<RateLimitCheckResult> {
    // Critical severity always bypasses rate limiting
    if (severity === NotificationSeverity.CRITICAL) {
      return { allowed: true };
    }

    const key = `notif:${clientId}:${type}:${severity}`;
    const exists = await this.redis.exists(key);

    if (exists) {
      const ttl = await this.redis.ttl(key);
      return {
        allowed: false,
        secondsUntilNext: ttl > 0 ? ttl : RATE_LIMIT_WINDOW,
      };
    }

    // Set key with 4-hour TTL
    await this.redis.setex(key, RATE_LIMIT_WINDOW, Date.now().toString());
    return { allowed: true };
  }
}
