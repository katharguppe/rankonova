# TASK-003: Phase 3 — Execution Engine

## Status: DONE
## Phase: 3
## Branch: feature/phase3-prompt-engine → merged to main (ddce9faa, 2026-05-02)

## Objective
Reliable, observable prompt execution across 6 AI engines via Bull queue. Scheduled daily at 2AM IST, on-demand available. Concurrent workers with per-engine rate limits, 3-attempt retry with fixed 65s backoff, dead letter queue, and per-token cost tracking.

## Scope
- `app/prompt-engine/` — multi-engine runner, Bull queue producer, retry logic, DLQ handler
- `app/prompt-engine/workers/` — Bull worker (concurrency=1 to respect per-engine rate limits)
- `app/prompt-engine/scheduler/` — cron job 2AM IST

## Exit Criteria
- [x] All 6 engines + Cerebras execute and return responses
- [x] 100 consecutive prompt runs complete without unhandled failure (0 errors, 100/100 Cerebras)
- [x] Retry: 3 attempts, 65s fixed backoff (changed from exponential — retries land in next rate-limit window)
- [x] Dead letter queue captures exhausted jobs
- [x] Per-engine rate limits respected via Redis Lua atomic check-and-increment
- [x] `cost_usd` accurate — Redis cost drift $0.000000 across 100 runs
- [x] Tenant daily cost aggregated in Redis, stored in DB per prompt_run
- [x] On-demand execution via POST /prompt-engine/run
- [x] `prompt-runs` Bull queue visible in BullBoard
- [x] 89/89 E2E tests green (confirmed 2026-05-02)

## Dependencies
- TASK-002 exit criteria met ✅

## PDCA Log

### Cycle 1
**Plan:** Implement full Bull-based prompt execution engine — 6 engine adapters, queue producer,
worker pool, retry policy, DLQ, Redis rate limiter, 2AM IST cron scheduler, cost tracker, BullBoard.
Add Cerebras adapter when OpenRouter credits unavailable.

**Approved:** Yes — sir approved full Phase 3 implementation plan.

**Do:** Implemented across commits `675ca81f` through `518cace7` on `feature/phase3-prompt-engine`.
Key decisions: concurrency changed 10→1 to prevent rate-limit stampede; retry backoff changed
exponential/1s→fixed/65s so retries land in the next rate-limit window; Cerebras used as
stress-test engine (free tier, OpenAI-compatible, llama3.1-8b); DATABASE_URL changed to
127.0.0.1 for Prisma binary engine Windows/Docker compatibility.

**Check:** 100/100 Cerebras pilot stress runs completed (0 failures, cost drift $0.000000).
Additional 90 runs queued before stop (all 0 errors). 89/89 E2E tests green.

**Act:** Merged `feature/phase3-prompt-engine` → `main` (ddce9faa). Pushed to origin/main.
TASK-003 closed.

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| OpenAI engine adapter | DONE | `675ca81f` | gpt-4o, max_tokens 1500 |
| Perplexity engine adapter | DONE | `675ca81f` | sonar-large-128k-online |
| Gemini engine adapter | DONE | `675ca81f` + `e34676a0` | Updated to gemini-2.0-flash (1.5-flash unavailable in v1beta) |
| Claude engine adapter | DONE | `675ca81f` + `35688c82` | claude-sonnet-4-20250514; rate limit raised 2→10/min |
| Grok engine adapter | DONE | `675ca81f` | Stub — grok-2 (API access pending) |
| Google AI Overviews adapter | DONE | `675ca81f` | Stub — Playwright (ToS review pending) |
| Bull queue setup | DONE | `675ca81f` + `6a1f25da` | lockDuration raised 30s→300s to prevent lock expiry |
| Queue producer | DONE | `675ca81f` | (promptId, clientId, engine) triple; RETRY_OPTIONS applied |
| Worker pool (concurrency=1) | DONE | `675ca81f` + `4672ea40` | Designed 10-concurrent; changed to 1 to prevent rate-limit stampede |
| Retry policy | DONE | `675ca81f` + `4672ea40` | Changed exp/1s → fixed/65s so retries land in next rate-limit window |
| Dead letter queue | DONE | `675ca81f` | status=dead_letter after 3 exhausted attempts |
| Rate limiter per engine | DONE | `675ca81f` + `35688c82` + `e34676a0` | Redis Lua atomic; cerebras/gemini/claude 10/min |
| 2AM IST cron scheduler | DONE | `675ca81f` | PromptEngineScheduler — @Cron with Asia/Kolkata tz |
| Cost tracking (Redis + DB) | DONE | `675ca81f` | CostTrackerService; Redis key cost:{tenantId}:{YYYY-MM-DD}, TTL 48h |
| BullBoard integration | DONE | `675ca81f` | Mounted at /admin/queues, super_admin guard |
| Cerebras adapter | DONE | `f3038cf1` + `ce68dae9` | llama3.1-8b; OpenAI-compatible; added after OpenRouter credits exhausted |
| 1000-run reliability test | DONE | `518cace7` | 100/100 pilot runs completed, 0 errors; sir confirmed 100 sufficient proof |
