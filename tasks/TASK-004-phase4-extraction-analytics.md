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
- [ ] Redis cache: `citation:{clientId}:{window}:{engine}:{intent}` present, TTL 1h
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

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Cerebras extraction service | DONE | `5dfa9183` | llama3.1-8b, structured JSON, markdown fence strip |
| Alias resolution logic | DONE | `5dfa9183` | Client + competitor aliases, lowercase normalisation |
| BrandMention writer (idempotent) | DONE | `5dfa9183` | Upsert on @@unique([run_id, brand_name]) |
| Extraction pipeline wired to worker | DONE | `72f2e069` | Direct call replaces @OnEvent — 6 mentions in <3s verified |
| POST /extraction/trigger/:runId | DONE | `e9b3a5e3` | Debug endpoint for manual re-extraction |
| Citation score calculator | TODO | — | 7/30/90-day windows (analytics session) |
| Redis cache writer/reader | TODO | — | TTL 1h, recalc on miss (analytics session) |
| Share of voice query | TODO | — | Client vs each competitor (analytics session) |
| Anomaly detector | TODO | — | Threshold checks post-extraction (analytics session) |
| Notification creator | TODO | — | Critical/High on breach (analytics session) |
| 200-response accuracy validation | TODO | — | Manual ground truth comparison |
