import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import Redis from 'ioredis';
import { PrismaModule } from '../prisma/prisma.module';
import { PromptsModule } from '../prompts/prompts.module';
import { ChatGptAdapter } from './adapters/chatgpt.adapter';
import { ClaudeAdapter } from './adapters/claude.adapter';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { GoogleAioAdapter } from './adapters/google-aio.adapter';
import { GrokAdapter } from './adapters/grok.adapter';
import { PerplexityAdapter } from './adapters/perplexity.adapter';
import { CostTrackerService } from './cost/cost-tracker.service';
import { EngineAdapterFactory } from './engine-adapter.factory';
import { PE_REDIS, PROMPT_RUNS_QUEUE } from './prompt-engine.constants';
import { PromptEngineController } from './prompt-engine.controller';
import { PromptEngineService } from './prompt-engine.service';
import { PromptRunQueueService } from './queue/prompt-run.queue';
import { EngineRateLimiterService } from './rate-limiter/engine-rate-limiter.service';
import { PromptEngineScheduler } from './scheduler/prompt-engine.scheduler';
import { PromptRunWorker } from './workers/prompt-run.worker';

@Module({
  imports: [
    PrismaModule,
    PromptsModule,
    BullModule.registerQueue({
      name: PROMPT_RUNS_QUEUE,
      settings: {
        lockDuration: 300_000,  // 5 min — covers worst-case API call + 3 retries with backoff
        lockRenewTime: 30_000,  // renew every 30s (10× per lock window)
      },
    }),
  ],
  controllers: [PromptEngineController],
  providers: [
    PromptEngineService,
    PromptRunQueueService,
    PromptRunWorker,
    PromptEngineScheduler,
    EngineAdapterFactory,
    ChatGptAdapter,
    PerplexityAdapter,
    GeminiAdapter,
    ClaudeAdapter,
    GrokAdapter,
    GoogleAioAdapter,
    EngineRateLimiterService,
    CostTrackerService,
    {
      provide: PE_REDIS,
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
    },
  ],
  exports: [PromptEngineService, PromptRunQueueService],
})
export class PromptEngineModule {}
