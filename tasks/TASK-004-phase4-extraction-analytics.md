# TASK-004: Phase 4 — Extraction and Analytics

## Status: PLANNING
## Phase: 4
## Branch: feature/TASK-004 (create when TASK-003 exits)

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
**Plan:**
**Approved:** Pending
**Do:**
**Check:**
**Act:**

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Claude Haiku extraction service | TODO | — | Structured JSON output |
| Alias resolution logic | TODO | — | Client + competitor aliases |
| BrandMention writer (idempotent) | TODO | — | Upsert on run_id + brand |
| Citation score calculator | TODO | — | 7/30/90-day windows |
| Redis cache writer/reader | TODO | — | TTL 1h, recalc on miss |
| Share of voice query | TODO | — | Client vs each competitor |
| Anomaly detector | TODO | — | Threshold checks post-extraction |
| Notification creator | TODO | — | Critical/High on breach |
| extraction.requested event handler | TODO | — | Wired to PromptRun completion |
| 200-response accuracy validation | TODO | — | Manual ground truth comparison |
