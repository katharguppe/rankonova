# TASK-003: Phase 3 — Execution Engine

## Status: PLANNING
## Phase: 3
## Branch: feature/phase3-prompt-engine (create from main — all Phase 2 work is on main as of 2026-04-28)

## Objective
Reliable, observable prompt execution across 6 AI engines via Bull queue. Scheduled daily at 2AM IST, on-demand available. 10 concurrent workers with per-engine rate limits, 3-attempt retry with exponential backoff, dead letter queue, and per-token cost tracking.

## Scope
- `src/prompt-engine/` — multi-engine runner, Bull queue producer, retry logic, DLQ handler
- `src/prompt-engine/workers/` — Bull workers per engine (or pooled)
- `src/prompt-engine/scheduler/` — cron job 2AM IST

## Exit Criteria
- [ ] All 6 engines execute and return responses: ChatGPT (gpt-4o), Perplexity (sonar-large-128k-online), Gemini (gemini-1.5-pro), Claude (claude-sonnet-4-20250514), Grok (grok-2), Google AI Overviews (Playwright)
- [ ] 1000 consecutive prompt runs complete without unhandled failure
- [ ] Retry: 3 attempts, exponential backoff (1s, 4s, 16s) confirmed in logs
- [ ] Dead letter queue captures exhausted jobs, super_admin alert triggered
- [ ] Per-engine rate limits respected (OpenAI 5/min, Perplexity 3/min, etc.)
- [ ] `cost_usd` accurate within 5% vs actual token billing for 100 test runs
- [ ] Tenant daily cost aggregated in Redis, stored monthly in DB
- [ ] On-demand execution counts against quota
- [ ] `prompt-runs` Bull queue visible in BullBoard

## Dependencies
- TASK-002 exit criteria met
- Open Question #1: Perplexity cited URL format (Dev)
- Open Question #3: Grok API production access (Dev)
- Open Question #4: Google AI Overviews ToS (Srinivas)
- Open Question #11: Playwright residential proxy (Dev)

## PDCA Log

### Cycle 1
**Plan:**
**Approved:** Pending
**Do:**
**Check:**
**Act:**

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| OpenAI engine adapter | TODO | — | gpt-4o, max_tokens 1500 |
| Perplexity engine adapter | TODO | — | sonar-large-128k-online |
| Gemini engine adapter | TODO | — | gemini-1.5-pro |
| Claude engine adapter | TODO | — | claude-sonnet-4-20250514 |
| Grok engine adapter | TODO | — | grok-2 |
| Google AI Overviews adapter | TODO | — | Playwright headless |
| Bull queue setup | TODO | — | prompt-runs queue, Redis-backed |
| Queue producer | TODO | — | (prompt, client, engine) triple |
| Worker pool (10 concurrent) | TODO | — | |
| Retry policy | TODO | — | 3 attempts, exp backoff |
| Dead letter queue | TODO | — | Alert on DLQ entry |
| Rate limiter per engine | TODO | — | Redis token bucket |
| 2AM IST cron scheduler | TODO | — | |
| Cost tracking (Redis + DB) | TODO | — | Per token, per tenant |
| BullBoard integration | TODO | — | super_admin access only |
| 1000-run reliability test | TODO | — | |
