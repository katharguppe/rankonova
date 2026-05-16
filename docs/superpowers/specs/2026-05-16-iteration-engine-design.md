# Iteration Engine Design
Date: 2026-05-16
Task: TASK-014
Phase: 14 — Prompt Iteration Tracking

---

## Overview

An iteration represents one full cycle of the 25 agent-generated prompts for a single client
across all 5 AI engines (125 PromptRun jobs total). The iteration engine tracks lifecycle from
creation through completion, stores state in Redis during the run, and auto-triggers the
agent-reco stub on completion.

---

## Scope

Touch ONLY:
- `prisma/schema/schema.prisma` — new PromptIteration model + nullable iteration_id on PromptRun
- `prisma/migrations/` — additive migration, no breaking changes
- `app/prompt-engine/scheduler/prompt-engine.scheduler.ts` — extend (do not rewrite)
- `app/prompt-engine/queue/prompt-run.queue.ts` — extend (do not rewrite)
- `app/prompt-engine/workers/prompt-run.worker.ts` — extend (do not rewrite)
- `app/prompt-engine/prompt-engine.types.ts` — extend payload type
- `app/prompt-engine/prompt-engine.module.ts` — register IterationService
- `app/prompt-engine/iteration/` — NEW subfolder

The existing daily batch for platform prompts is NOT touched and continues unchanged.

---

## Data Model

### New: PromptIteration

```prisma
model PromptIteration {
  id               String    @id @default(cuid())
  client_id        String
  iteration_number Int
  started_at       DateTime  @default(now())
  completed_at     DateTime?
  status           String    @default("running")  // running | completed | failed

  client      Client      @relation(fields: [client_id], references: [id])
  prompt_runs PromptRun[]

  @@index([client_id])
  @@index([client_id, iteration_number])
  @@map("prompt_iterations")
}
```

### Change: PromptRun

Add nullable `iteration_id` field. All existing rows unaffected (null = platform run).

```prisma
iteration_id   String?
iteration      PromptIteration? @relation(fields: [iteration_id], references: [id])
```

---

## Redis Keys

| Key | Value | TTL |
|-----|-------|-----|
| `iteration:{clientId}:current` | iterationId (string) | 7200s (2h) |
| `iteration:{clientId}:remaining` | integer count | 7200s (2h) |

TTL of 2h covers a worst-case full run window. If Redis restarts mid-run, the counter is
lost and completion never fires — this is acceptable for a daily batch (next day creates a
new iteration). The DB record remains with status=running and can be reconciled by ops.

---

## Execution Flow

### Scheduler (2AM IST)

1. Fetch all active clients (existing logic, unchanged)
2. For each client that has agent prompts (`source='agent'`, up to 25):
   - Call `IterationService.create(clientId)` → DB record, iteration_number = last + 1
   - Call `queue.enqueueAgentBatch(clientId, tenantId, promptIds, iterationId)`
   - `enqueueAgentBatch` sets Redis counter to `promptIds.length × SCHEDULED_ENGINES.length`
3. Existing platform-prompt loop runs as before (no change)

### Worker (per agent PromptRun job)

After a run reaches terminal state (completed, failed, or dead_letter):
- Call `IterationService.tick(clientId)` — DECR Redis remaining counter
- If counter reaches 0: call `IterationService.complete(iterationId, clientId)`

### IterationService.complete()

1. Update DB: `status = 'completed'`, `completed_at = now()`
2. DEL `iteration:{clientId}:current` and `iteration:{clientId}:remaining`
3. Fire-and-forget HTTP POST to `/agent-reco/:iterationId` (stub endpoint)

---

## IterationService API

```typescript
create(clientId: string): Promise<PromptIteration>
  // auto-increments iteration_number per client (MAX + 1, default 1)

tick(clientId: string, iterationId: string): Promise<void>
  // DECR Redis counter; calls complete() if counter <= 0

complete(iterationId: string, clientId: string): Promise<void>
  // DB update + Redis cleanup + agent-reco POST
```

---

## New Files

- `app/prompt-engine/iteration/iteration.service.ts`
- `app/prompt-engine/iteration/iteration.service.spec.ts`

---

## Modified Files

| File | Change |
|------|--------|
| `prisma/schema/schema.prisma` | Add PromptIteration model + iteration_id on PromptRun |
| `app/prompt-engine/prompt-engine.types.ts` | Add `iterationId?: string` to PromptRunJobPayload |
| `app/prompt-engine/queue/prompt-run.queue.ts` | Add `enqueueAgentBatch()` method |
| `app/prompt-engine/workers/prompt-run.worker.ts` | Call `IterationService.tick()` on terminal state |
| `app/prompt-engine/scheduler/prompt-engine.scheduler.ts` | Call `IterationService.create()` + enqueue agent batch |
| `app/prompt-engine/prompt-engine.module.ts` | Register IterationService, inject Redis |

---

## Testing

Unit tests in `iteration.service.spec.ts`:
- `create()` sets iteration_number = last + 1 (and 1 for first)
- `tick()` decrements Redis counter
- `tick()` calls `complete()` when counter reaches 0
- `complete()` updates DB status and cleans Redis keys
- `complete()` fires agent-reco POST (mocked HttpService)

All existing `prompt-engine` tests must remain green.

---

## Constraints

- Do NOT rewrite existing scheduler or queue — extend only
- Platform prompt batch is untouched
- `iteration_id` is nullable — all existing PromptRun rows remain valid
- Migration is additive only
- agent-reco POST is fire-and-forget (no retry, no blocking)
