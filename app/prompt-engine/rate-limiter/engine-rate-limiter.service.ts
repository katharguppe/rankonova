import { Inject, Injectable } from '@nestjs/common';
import { AiEngine } from '@prisma/client';
import Redis from 'ioredis';
import { PE_REDIS } from '../prompt-engine.constants';

const RATE_LIMITS: Partial<Record<AiEngine, number>> = {
  [AiEngine.chatgpt]: 5,
  [AiEngine.perplexity]: 3,
  [AiEngine.gemini]: 10, // raised from 2 for stress test; Google free tier = 15 RPM
  [AiEngine.claude]: 10, // raised from 2 for dev; production cap via OpenRouter account limits
  [AiEngine.grok]: 2,
  [AiEngine.google_ai_overviews]: 2,
  [AiEngine.cerebras]: 10, // free tier 30 RPM; capped at 10 to match stress-test batch size
};

// Atomic check-and-increment via Lua to avoid TOCTOU race
const ACQUIRE_SCRIPT = `
  local count = redis.call('GET', KEYS[1])
  count = count and tonumber(count) or 0
  if count < tonumber(ARGV[1]) then
    local n = redis.call('INCR', KEYS[1])
    if n == 1 then redis.call('EXPIRE', KEYS[1], 120) end
    return 1
  end
  return 0
`;

@Injectable()
export class EngineRateLimiterService {
  constructor(@Inject(PE_REDIS) private readonly redis: Redis) {}

  async tryAcquire(engine: AiEngine): Promise<boolean> {
    const limit = RATE_LIMITS[engine] ?? 1;
    const window = Math.floor(Date.now() / 60_000);
    const key = `rl:${engine}:${window}`;
    const result = (await this.redis.eval(ACQUIRE_SCRIPT, 1, key, String(limit))) as number;
    return result === 1;
  }
}
