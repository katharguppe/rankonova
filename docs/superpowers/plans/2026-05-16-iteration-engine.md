# Iteration Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track each client's 25-agent-prompt daily run as a single PromptIteration record, using a Redis counter to detect completion and auto-trigger the agent-reco stub.

**Architecture:** IterationService owns the full lifecycle (create → tick → complete). The scheduler calls `create()` before enqueueing agent runs; each worker calls `tick()` on terminal state; when the Redis counter hits zero, `complete()` updates the DB, clears Redis, and fires a fire-and-forget POST to `/agent-reco/:iterationId`.

**Tech Stack:** NestJS, Prisma 7, Bull queue, ioredis, Jest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/prompt-engine/iteration/iteration.service.ts` | create / tick / complete lifecycle |
| Create | `app/prompt-engine/iteration/iteration.service.spec.ts` | unit tests for IterationService |
| Modify | `prisma/schema/schema.prisma` | add PromptIteration model + iteration_id on PromptRun |
| Migrate | `prisma/migrations/` | additive migration (npx prisma migrate dev) |
| Modify | `app/prompt-engine/prompt-engine.types.ts` | add `iterationId?: string` to PromptRunJobPayload |
| Modify | `app/prompt-engine/queue/prompt-run.queue.ts` | add `enqueueAgentBatch()` method |
| Modify | `app/prompt-engine/workers/prompt-run.worker.ts` | call `IterationService.tick()` on terminal state |
| Modify | `app/prompt-engine/scheduler/prompt-engine.scheduler.ts` | call `IterationService.create()` + enqueue agent batch |
| Modify | `app/prompt-engine/prompt-engine.module.ts` | register IterationService |

---

## Task 1: Schema — Add PromptIteration model + iteration_id on PromptRun

**Files:**
- Modify: `prisma/schema/schema.prisma`

- [ ] **Step 1: Open schema and locate the PromptRun model (line ~390)**

Read `prisma/schema/schema.prisma` around line 390.

- [ ] **Step 2: Add PromptIteration model after the PromptRun model block**

Insert this block immediately after the closing `}` of the `PromptRun` model (before the `// BRAND MENTIONS` comment):

```prisma
model PromptIteration {
  id               String    @id @default(cuid())
  client_id        String
  iteration_number Int
  started_at       DateTime  @default(now())
  completed_at     DateTime?
  status           String    @default("running")

  client      Client      @relation(fields: [client_id], references: [id])
  prompt_runs PromptRun[]

  @@index([client_id])
  @@index([client_id, iteration_number])
  @@map("prompt_iterations")
}
```

- [ ] **Step 3: Add relation fields to PromptRun model**

Inside the `PromptRun` model, after the `cost_usd` field and before `created_at`, add:

```prisma
  iteration_id   String?
  iteration      PromptIteration? @relation(fields: [iteration_id], references: [id])
```

Also add an index after the existing indexes:

```prisma
  @@index([iteration_id])
```

- [ ] **Step 4: Add back-relation on Client model**

Find the `Client` model (around line 281). After the `prompt_runs PromptRun[]` line, add:

```prisma
  prompt_iterations PromptIteration[]
```

- [ ] **Step 5: Run migration**

```bash
cd D:/staging/aeo-suite
npx prisma migrate dev --name add_prompt_iteration
```

Expected: migration file created in `prisma/migrations/`, schema applied to DB with 0 errors.

- [ ] **Step 6: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` message, no errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema/schema.prisma prisma/migrations/
git commit -m "[TASK-014] feat: add PromptIteration model and iteration_id to PromptRun"
```

---

## Task 2: Extend PromptRunJobPayload type

**Files:**
- Modify: `app/prompt-engine/prompt-engine.types.ts`

- [ ] **Step 1: Add iterationId to the payload interface**

Replace the entire file content with:

```typescript
import { AiEngine } from '@prisma/client';

export interface PromptRunJobPayload {
  promptRunId: string;
  promptId: string;
  clientId: string;
  tenantId: string;
  engine: AiEngine;
  iterationId?: string;
}
```

- [ ] **Step 2: Type-check**

```bash
cd D:/staging/aeo-suite
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/prompt-engine/prompt-engine.types.ts
git commit -m "[TASK-014] feat: add iterationId to PromptRunJobPayload"
```

---

## Task 3: Write IterationService (TDD — tests first)

**Files:**
- Create: `app/prompt-engine/iteration/iteration.service.spec.ts`
- Create: `app/prompt-engine/iteration/iteration.service.ts`

- [ ] **Step 1: Create the test file**

Create `app/prompt-engine/iteration/iteration.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { IterationService } from './iteration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PE_REDIS } from '../prompt-engine.constants';

const mockPrisma = {
  promptIteration: {
    create: jest.fn(),
    aggregate: jest.fn(),
    update: jest.fn(),
  },
  promptRun: { updateMany: jest.fn() },
};

const mockRedis = {
  set: jest.fn(),
  decr: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
};

const mockHttp = { axiosRef: { post: jest.fn() } };

describe('IterationService', () => {
  let service: IterationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IterationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PE_REDIS, useValue: mockRedis },
        { provide: 'HttpService', useValue: mockHttp },
      ],
    }).compile();

    service = module.get<IterationService>(IterationService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('sets iteration_number to 1 when no prior iterations exist', async () => {
      mockPrisma.promptIteration.aggregate.mockResolvedValue({ _max: { iteration_number: null } });
      mockPrisma.promptIteration.create.mockResolvedValue({
        id: 'iter1',
        client_id: 'c1',
        iteration_number: 1,
        status: 'running',
        started_at: new Date(),
        completed_at: null,
      });

      const result = await service.create('c1');

      expect(mockPrisma.promptIteration.create).toHaveBeenCalledWith({
        data: { client_id: 'c1', iteration_number: 1, status: 'running' },
      });
      expect(result.iteration_number).toBe(1);
    });

    it('increments iteration_number from last value', async () => {
      mockPrisma.promptIteration.aggregate.mockResolvedValue({ _max: { iteration_number: 4 } });
      mockPrisma.promptIteration.create.mockResolvedValue({
        id: 'iter5',
        client_id: 'c1',
        iteration_number: 5,
        status: 'running',
        started_at: new Date(),
        completed_at: null,
      });

      await service.create('c1');

      expect(mockPrisma.promptIteration.create).toHaveBeenCalledWith({
        data: { client_id: 'c1', iteration_number: 5, status: 'running' },
      });
    });
  });

  describe('setCounter()', () => {
    it('sets Redis remaining counter with 2h TTL', async () => {
      await service.setCounter('c1', 'iter1', 125);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'iteration:c1:current', 'iter1', 'EX', 7200,
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'iteration:c1:remaining', 125, 'EX', 7200,
      );
    });
  });

  describe('tick()', () => {
    it('decrements counter and does NOT call complete when counter > 0', async () => {
      mockRedis.decr.mockResolvedValue(10);
      const completeSpy = jest.spyOn(service, 'complete').mockResolvedValue();

      await service.tick('c1', 'iter1');

      expect(mockRedis.decr).toHaveBeenCalledWith('iteration:c1:remaining');
      expect(completeSpy).not.toHaveBeenCalled();
    });

    it('calls complete() when counter reaches 0', async () => {
      mockRedis.decr.mockResolvedValue(0);
      const completeSpy = jest.spyOn(service, 'complete').mockResolvedValue();

      await service.tick('c1', 'iter1');

      expect(completeSpy).toHaveBeenCalledWith('iter1', 'c1');
    });

    it('calls complete() when counter goes negative (safety net)', async () => {
      mockRedis.decr.mockResolvedValue(-1);
      const completeSpy = jest.spyOn(service, 'complete').mockResolvedValue();

      await service.tick('c1', 'iter1');

      expect(completeSpy).toHaveBeenCalledWith('iter1', 'c1');
    });
  });

  describe('complete()', () => {
    it('updates DB status to completed with completed_at', async () => {
      mockPrisma.promptIteration.update.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(2);
      mockHttp.axiosRef.post.mockResolvedValue({});

      await service.complete('iter1', 'c1');

      expect(mockPrisma.promptIteration.update).toHaveBeenCalledWith({
        where: { id: 'iter1' },
        data: { status: 'completed', completed_at: expect.any(Date) },
      });
    });

    it('deletes both Redis keys', async () => {
      mockPrisma.promptIteration.update.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(2);
      mockHttp.axiosRef.post.mockResolvedValue({});

      await service.complete('iter1', 'c1');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'iteration:c1:current',
        'iteration:c1:remaining',
      );
    });

    it('fires agent-reco POST fire-and-forget (does not throw if POST fails)', async () => {
      mockPrisma.promptIteration.update.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(2);
      mockHttp.axiosRef.post.mockRejectedValue(new Error('network error'));

      await expect(service.complete('iter1', 'c1')).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
cd D:/staging/aeo-suite
npx jest --testPathPattern=iteration.service.spec --no-coverage
```

Expected: FAIL — `Cannot find module './iteration.service'`

- [ ] **Step 3: Create the implementation**

Create `app/prompt-engine/iteration/iteration.service.ts`:

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
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
    @Inject('HttpService') private readonly http: HttpService,
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

    this.http.axiosRef
      .post(`http://localhost:${process.env['PORT'] ?? 3000}/agent-reco/${iterationId}`)
      .catch((err: Error) =>
        this.logger.warn(`agent-reco POST failed for ${iterationId}: ${err.message}`),
      );
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd D:/staging/aeo-suite
npx jest --testPathPattern=iteration.service.spec --no-coverage
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/prompt-engine/iteration/
git commit -m "[TASK-014] feat: IterationService with create/tick/complete lifecycle"
```

---

## Task 4: Extend PromptRunQueueService with enqueueAgentBatch()

**Files:**
- Modify: `app/prompt-engine/queue/prompt-run.queue.ts`

- [ ] **Step 1: Add enqueueAgentBatch() method**

Open `app/prompt-engine/queue/prompt-run.queue.ts`. After the closing `}` of `flushWaiting()`, add this method before the closing `}` of the class:

```typescript
  async enqueueAgentBatch(
    clientId: string,
    tenantId: string,
    promptIds: string[],
    engines: AiEngine[],
    iterationId: string,
  ): Promise<string[]> {
    const runIds: string[] = [];

    for (const promptId of promptIds) {
      for (const engine of engines) {
        const run = await this.prisma.promptRun.create({
          data: {
            prompt_id: promptId,
            client_id: clientId,
            engine,
            ran_at: new Date(),
            status: PromptRunStatus.pending,
            iteration_id: iterationId,
          },
        });

        const payload: PromptRunJobPayload = {
          promptRunId: run.id,
          promptId,
          clientId,
          tenantId,
          engine,
          iterationId,
        };

        await this.queue.add(JOB_NAME, payload, RETRY_OPTIONS);
        runIds.push(run.id);
      }
    }

    return runIds;
  }
```

- [ ] **Step 2: Type-check**

```bash
cd D:/staging/aeo-suite
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run prompt-engine tests to confirm no regressions**

```bash
cd D:/staging/aeo-suite
npx jest --testPathPattern=prompt-engine --no-coverage
```

Expected: all existing tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/prompt-engine/queue/prompt-run.queue.ts
git commit -m "[TASK-014] feat: add enqueueAgentBatch to PromptRunQueueService"
```

---

## Task 5: Extend PromptRunWorker to call tick()

**Files:**
- Modify: `app/prompt-engine/workers/prompt-run.worker.ts`

- [ ] **Step 1: Inject IterationService into PromptRunWorker**

In `prompt-run.worker.ts`, add the import at the top:

```typescript
import { IterationService } from '../iteration/iteration.service';
```

Add to the constructor (after `ExtractionService`):

```typescript
private readonly iterationService: IterationService,
```

- [ ] **Step 2: Call tick() after every terminal state in the process() method**

Locate the `process()` method. The terminal states are:
1. `PromptRunStatus.completed` (success path, around line 89)
2. The non-retriable `return` paths (entity not found, quota exceeded, NotImplementedException)

After the `await Promise.all([...quotaService.increment...])` block (success path), add:

```typescript
      if (job.data.iterationId) {
        await this.iterationService.tick(clientId, job.data.iterationId).catch((err: Error) =>
          this.logger.error(`Iteration tick failed for ${job.data.iterationId}: ${err.message}`),
        );
      }
```

After each non-retriable `return` statement (entity not found, quota exceeded, NotImplementedException), add the same tick call **before** the `return`:

```typescript
      if (job.data.iterationId) {
        await this.iterationService.tick(clientId, job.data.iterationId).catch((err: Error) =>
          this.logger.error(`Iteration tick failed for ${job.data.iterationId}: ${err.message}`),
        );
      }
```

> Note: tick() must be called on ALL terminal outcomes (success, non-retriable fail) so the counter always reaches zero. Do NOT call tick() before rethrowing retriable errors — those are not terminal.

- [ ] **Step 3: Type-check**

```bash
cd D:/staging/aeo-suite
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run prompt-engine tests**

```bash
cd D:/staging/aeo-suite
npx jest --testPathPattern=prompt-engine --no-coverage
```

Expected: all existing tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/prompt-engine/workers/prompt-run.worker.ts
git commit -m "[TASK-014] feat: call IterationService.tick() on terminal PromptRun states"
```

---

## Task 6: Extend Scheduler to create iteration and enqueue agent batch

**Files:**
- Modify: `app/prompt-engine/scheduler/prompt-engine.scheduler.ts`

- [ ] **Step 1: Inject IterationService into PromptEngineScheduler**

Add the import at the top of the file:

```typescript
import { IterationService } from '../iteration/iteration.service';
```

Add to the constructor after `PromptRunQueueService`:

```typescript
private readonly iterationService: IterationService,
```

- [ ] **Step 2: Add the agent-batch loop inside runDailyBatch()**

The existing platform-prompt loop is untouched. Add a second loop for agent prompts **after** the existing loop closes. Full `runDailyBatch()` method (show complete replacement):

```typescript
  @Cron('30 20 * * *')
  async runDailyBatch(): Promise<void> {
    this.logger.log('[Scheduler] Starting daily prompt batch');

    const clients = await this.prisma.client.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, tenant_id: true, vertical_id: true },
    });

    let enqueued = 0;

    // ── Platform prompts (unchanged) ──────────────────────────────────────
    for (const client of clients) {
      const prompts = await this.prisma.prompt.findMany({
        where: {
          vertical_id: client.vertical_id,
          is_active: true,
          OR: [{ tenant_id: null }, { tenant_id: client.tenant_id }],
        },
        select: { id: true },
      });

      for (const prompt of prompts) {
        await this.queue.enqueue(prompt.id, client.id, client.tenant_id, SCHEDULED_ENGINES);
        enqueued += SCHEDULED_ENGINES.length;
      }
    }

    this.logger.log(`[Scheduler] Enqueued ${enqueued} prompt runs across ${clients.length} clients`);

    // ── Agent prompts (iteration tracking) ───────────────────────────────
    let iterationsCreated = 0;

    for (const client of clients) {
      const agentPrompts = await this.prisma.prompt.findMany({
        where: {
          client_id: client.id,
          source: 'agent',
          is_active: true,
        },
        select: { id: true },
      });

      if (agentPrompts.length === 0) continue;

      const iteration = await this.iterationService.create(client.id);
      const promptIds = agentPrompts.map(p => p.id);
      const total = promptIds.length * SCHEDULED_ENGINES.length;

      await this.iterationService.setCounter(client.id, iteration.id, total);
      await this.queue.enqueueAgentBatch(
        client.id,
        client.tenant_id,
        promptIds,
        SCHEDULED_ENGINES,
        iteration.id,
      );

      iterationsCreated++;
      this.logger.log(
        `[Scheduler] Iteration ${iteration.iteration_number} created for client ${client.id} (${total} runs)`,
      );
    }

    this.logger.log(`[Scheduler] Created ${iterationsCreated} iterations`);
  }
```

- [ ] **Step 3: Type-check**

```bash
cd D:/staging/aeo-suite
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run prompt-engine tests**

```bash
cd D:/staging/aeo-suite
npx jest --testPathPattern=prompt-engine --no-coverage
```

Expected: all existing tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/prompt-engine/scheduler/prompt-engine.scheduler.ts
git commit -m "[TASK-014] feat: scheduler creates PromptIteration and enqueues agent batch"
```

---

## Task 7: Register IterationService in PromptEngineModule

**Files:**
- Modify: `app/prompt-engine/prompt-engine.module.ts`

- [ ] **Step 1: Add imports and providers**

Add the import at the top:

```typescript
import { HttpModule } from '@nestjs/axios';
import { IterationService } from './iteration/iteration.service';
```

In the `imports` array, add `HttpModule`:

```typescript
    HttpModule,
```

In the `providers` array, add `IterationService`:

```typescript
    IterationService,
```

- [ ] **Step 2: Type-check**

```bash
cd D:/staging/aeo-suite
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run all prompt-engine tests**

```bash
cd D:/staging/aeo-suite
npx jest --testPathPattern=prompt-engine --no-coverage
```

Expected: all tests PASS (includes the 8 new IterationService tests).

- [ ] **Step 4: Final type-check**

```bash
cd D:/staging/aeo-suite
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/prompt-engine/prompt-engine.module.ts
git commit -m "[TASK-014] feat: register IterationService and HttpModule in PromptEngineModule"
```

---

## Task 8: Final verification and wrap-up commit

- [ ] **Step 1: Run full prompt-engine test suite**

```bash
cd D:/staging/aeo-suite
npx jest --testPathPattern=prompt-engine --no-coverage
```

Expected: all tests PASS, no regressions.

- [ ] **Step 2: Run full project type-check**

```bash
cd D:/staging/aeo-suite
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Confirm git log**

```bash
cd D:/staging/aeo-suite
git log --oneline -8
```

Expected: 7 TASK-014 commits visible.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "[TASK-014] feat: prompt iteration engine with run tracking and Redis state"
```
