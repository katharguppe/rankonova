# TASK-004: Phase 4 — Extraction and Analytics

## Status: IN PROGRESS
## Phase: 4
## Branch: feature/TASK-004 (created from main dbf070fa, 2026-05-02)

## Objective
Async extraction pipeline processes every PromptRun and produces structured BrandMention records via Claude Haiku. Citation scoring (7/30/90-day windows) cached in Redis. Share of voice, anomaly detection with alerting.

## Scope
- `src/extraction/` — Haiku-powered extraction, alias resolution, idempotent pipeline
- `src/analytics/` — citation scoring, share of voice, anomaly detection, cache management

## Exit Criteria
- [ ] Extraction pipeline completes in under 3 seconds per run
- [ ] Alias-aware: "Tata Nexon" and "Nexon" map to same client in 200 test responses
- [ ] Idempotent: re-processing same run_id produces no duplicate BrandMentions
- [ ] Citation score accuracy: manual validation on 200 sample responses within 2% of ground truth
- [ ] Redis cache: `citation:{clientId}:{window}:{engine}:{intent}` present, TTL 1h
- [ ] Share of voice computation correct vs manually calculated reference
- [ ] Anomaly: -10 point drop in 24h creates Critical notification
- [ ] Anomaly: +15 point competitor spike creates High notification
- [ ] Extraction processes under load: 100 concurrent runs without errors

## Dependencies
- TASK-003 exit criteria met

## PDCA Log

### Cycle 1
**Plan:** ExtractionHaikuService (structured JSON via claude-haiku-4-5-20251001) + alias-aware
resolver + idempotent writer + OnEvent orchestrator. EventEmitterModule wired globally.
Minimal touch to PromptRunWorker (emit only). Prisma migration adds @@unique([run_id, brand_name]).

**Approved:** Yes (2026-05-02)

**Do:** Implemented in commit `5dfa9183` on feature/TASK-004.

**Check:** tsc --noEmit clean, eslint --max-warnings=0 clean. App restart pending.

**Act:** Pending live smoke test and 200-response accuracy validation.

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Claude Haiku extraction service | DONE | `5dfa9183` | claude-haiku-4-5-20251001, structured JSON, malformed JSON safe |
| Alias resolution logic | DONE | `5dfa9183` | Client + competitor aliases, lowercase normalisation |
| BrandMention writer (idempotent) | DONE | `5dfa9183` | Upsert on @@unique([run_id, brand_name]) |
| extraction.requested event handler | DONE | `5dfa9183` | OnEvent orchestrator, <3s warn threshold, idempotency guard |
| Citation score calculator | TODO | — | 7/30/90-day windows (analytics session) |
| Redis cache writer/reader | TODO | — | TTL 1h, recalc on miss (analytics session) |
| Share of voice query | TODO | — | Client vs each competitor (analytics session) |
| Anomaly detector | TODO | — | Threshold checks post-extraction (analytics session) |
| Notification creator | TODO | — | Critical/High on breach (analytics session) |
| 200-response accuracy validation | TODO | — | Manual ground truth comparison |
