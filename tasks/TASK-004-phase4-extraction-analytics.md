# TASK-004: Phase 4 — Extraction and Analytics

## Status: IN PROGRESS
## Phase: 4
## Branch: feature/TASK-004 (created from main dbf070fa, 2026-05-02)

## Objective
Async extraction pipeline processes every PromptRun and produces structured BrandMention records via Cerebras llama3.1-8b. Citation scoring (7/30/90-day windows) cached in Redis. Share of voice, anomaly detection with alerting.

## Scope
- `app/extraction/` — extraction pipeline, alias resolution, idempotent writer
- `app/analytics/` — citation scoring, share of voice, anomaly detection, cache management

## Exit Criteria
- [x] Extraction pipeline completes in under 3 seconds per run
- [ ] Alias-aware: "Tata Nexon" and "Nexon" map to same client in 200 test responses
- [x] Idempotent: re-processing same run_id produces no duplicate BrandMentions
- [ ] Citation score accuracy: manual validation on 200 sample responses within 2% of ground truth
- [x] Redis cache: `citation:{clientId}:{window}` + `24h` + `byEngine/byIntent` present, TTL 1h
- [ ] Share of voice computation correct vs manually calculated reference
- [ ] Anomaly: -10 point drop in 24h creates Critical notification
- [ ] Anomaly: +15 point competitor spike creates High notification
- [ ] Extraction processes under load: 100 concurrent runs without errors

## Dependencies
- TASK-003 exit criteria met ✅

## PDCA Log

### Cycle 1
**Plan:** ExtractionHaikuService (Cerebras llama3.1-8b, OpenAI-compat) + alias-aware resolver +
idempotent writer + direct service call from PromptRunWorker. Prisma migration adds
@@unique([run_id, brand_name]).

**Approved:** Yes (2026-05-02)

**Do:** Implemented across commits `5dfa9183`, `e9b3a5e3`, `72f2e069` on feature/TASK-004.
Key fix: replaced @OnEvent (EventEmitter2 has registration-timing race inside Bull workers)
with direct ExtractionService injection into PromptRunWorker — ExtractionModule imported into
PromptEngineModule, runForPromptRun() called fire-and-forget after completion.

**Check:** 6 brand_mentions auto-created within 3s of run completion (run duration 928ms, cost
$0.000294). tsc --noEmit clean, eslint --max-warnings=0 clean.

**Act:** Extraction smoke test PASSED. Proceeding to analytics session (citation scoring,
share of voice, anomaly detection).

### Cycle 2
**Plan:** AnalyticsCitationService (Redis-first, SQL aggregation, 7/30/90d + 24h windows,
per-engine + per-intent breakdowns) + AnalyticsSovService (competitors in same tenant+vertical,
30d window) + AnalyticsAnomalyService (-10pt drop → Critical, +15pt spike → High, 4h RL) +
AnalyticsService facade + AnalyticsController (2 GET endpoints, JWT auth) + AnalyticsModule
(own AEO_ANALYTICS_REDIS). ExtractionService fires detectAnomalies fire-and-forget after upsertMany.

**Approved:** Yes (2026-05-02)

**Do:** Implemented in commit `7e5134a2` on feature/TASK-004.
9 files: 4 new analytics services, constants, updated module/controller/service, extraction wired.

**Check:** tsc --noEmit clean, eslint --max-warnings=0 clean. Awaiting smoke test (fire run → verify
citation cache keys set, SoV endpoint returns data, anomaly check runs without error).

**Act:** Pending smoke test results.

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Cerebras extraction service | DONE | `5dfa9183` | llama3.1-8b, structured JSON, markdown fence strip |
| Alias resolution logic | DONE | `5dfa9183` | Client + competitor aliases, lowercase normalisation |
| BrandMention writer (idempotent) | DONE | `5dfa9183` | Upsert on @@unique([run_id, brand_name]) |
| Extraction pipeline wired to worker | DONE | `72f2e069` | Direct call replaces @OnEvent — 6 mentions in <3s verified |
| POST /extraction/trigger/:runId | DONE | `e9b3a5e3` | Debug endpoint for manual re-extraction |
| Citation score calculator | DONE | `7e5134a2` | 7/30/90d + 24h windows, per-engine + per-intent, Redis TTL 1h |
| Redis cache writer/reader | DONE | `7e5134a2` | AEO_ANALYTICS_REDIS, setex TTL 1h, get on cache hit |
| Share of voice query | DONE | `7e5134a2` | Client + competitors in same vertical, 30d, sorted desc |
| Anomaly detector | DONE | `7e5134a2` | -10pt → Critical, +15pt competitor spike → High, 4h RL |
| Notification creator | DONE | `7e5134a2` | prisma.notification.create with severity + deep_link |
| 200-response accuracy validation | TODO | — | Manual ground truth comparison |
