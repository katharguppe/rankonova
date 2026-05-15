import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { RateLimiterService } from '../rate-limiter.service';
import { NotificationSeverity, NotificationType } from '../notifications.types';

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let redis: Redis;

  beforeEach(async () => {
    redis = new Redis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        {
          provide: 'REDIS_CLIENT',
          useValue: redis,
        },
      ],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.flushdb();
    await redis.quit();
  });

  describe('canSend', () => {
    it('should allow first event', async () => {
      const result = await service.canSend('client-1', NotificationType.CITATION_DROP, NotificationSeverity.HIGH);
      expect(result.allowed).toBe(true);
      expect(result.secondsUntilNext).toBeUndefined();
    });

    it('should block duplicate within 4 hours', async () => {
      await service.canSend('client-1', NotificationType.CITATION_DROP, NotificationSeverity.HIGH);
      const result = await service.canSend('client-1', NotificationType.CITATION_DROP, NotificationSeverity.HIGH);

      expect(result.allowed).toBe(false);
      expect(result.secondsUntilNext).toBeDefined();
      expect(result.secondsUntilNext).toBeGreaterThan(0);
      expect(result.secondsUntilNext).toBeLessThanOrEqual(14400);
    });

    it('should allow different type within 4 hours', async () => {
      await service.canSend('client-1', NotificationType.CITATION_DROP, NotificationSeverity.HIGH);
      const result = await service.canSend('client-1', NotificationType.COMPETITOR_SPIKE, NotificationSeverity.HIGH);

      expect(result.allowed).toBe(true);
    });

    it('should allow same type different client', async () => {
      await service.canSend('client-1', NotificationType.CITATION_DROP, NotificationSeverity.HIGH);
      const result = await service.canSend('client-2', NotificationType.CITATION_DROP, NotificationSeverity.HIGH);

      expect(result.allowed).toBe(true);
    });

    it('should always allow Critical severity', async () => {
      await service.canSend('client-1', NotificationType.PAYMENT_FAILED, NotificationSeverity.CRITICAL);
      const result = await service.canSend('client-1', NotificationType.PAYMENT_FAILED, NotificationSeverity.CRITICAL);
      const result2 = await service.canSend('client-1', NotificationType.PAYMENT_FAILED, NotificationSeverity.CRITICAL);

      expect(result.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });
});
