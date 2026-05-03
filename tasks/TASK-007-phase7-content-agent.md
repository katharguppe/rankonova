# TASK-007: Phase 7 — Content Agent

## Status: IN PROGRESS
## Phase: 7
## Branch: feature/TASK-007 (create when TASK-006 exits)

## Objective
Generate production-ready AEO-optimized HTML pages with embedded JSON-LD schema. Four content types. Automated quality validation before save. Human approval workflow with revision loop. Platform never auto-publishes.

## Scope
- `src/content-agent/` — generation pipeline, 4 content type generators, quality validator, approval workflow

## Exit Criteria
- [ ] All 4 types generate without errors: FAQ Page, Comparison Page, Entity Authority Page, Segment Article
- [ ] FAQ Page: 6-8 Q&A pairs, FAQPage JSON-LD valid, secondary vertical schema present
- [ ] Answer rules enforced (validated post-generation): answer in first sentence, ≥1 specific number, ≤90 words, no unsupported superlatives
- [ ] Comparison Page: spec table with schema markup (not image), FAQPage schema
- [ ] Entity Authority Page: correct schema.org type per vertical, Wikidata-compatible facts block
- [ ] Segment Article: 1200-1800 words, HowTo or Article schema, client mentioned naturally
- [ ] Quality validator catches and flags: invalid JSON-LD, answer >90 words, no number in answer, blocked phrases, broken HTML, title >70 chars
- [ ] Approval workflow: draft → notify client_manager → approve/revision/reject → regenerate with notes
- [ ] 60-day `citation_rate_after` capture scheduled correctly
- [ ] 50 pieces reviewed by Srinivas, quality standard met

## Dependencies
- TASK-006 exit criteria met (gap report feeds content generation context)

## PDCA Log

### Cycle 1
**Plan:** Add `follow_up_scheduled_at` + `previous_version_id` self-relation to `ContentOutput`; run migration; regenerate Prisma client.
**Approved:** 2026-05-03
**Do:** Updated `prisma/schema/schema.prisma`; wrote migration SQL; `prisma migrate deploy`; `prisma generate`.
**Check:** Migration applied (5/5 green). Backend typecheck clean.
**Act:** Committed. Ready for Cycle 2 (FAQ Page generator).

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Prisma schema + migration | DONE | — | +follow_up_scheduled_at, +previous_version_id self-rel |
| FAQ Page generator | TODO | — | Claude Sonnet + AEO system prompt |
| Comparison Page generator | TODO | — | |
| Entity Authority Page generator | TODO | — | |
| Segment Article generator | TODO | — | 1200-1800 words |
| JSON-LD validator | TODO | — | Parses without error |
| Answer rules validator | TODO | — | Length, number, superlatives |
| Blocked phrases checker | TODO | — | Replacement suggestions |
| HTML validator | TODO | — | No broken tags |
| Approval workflow state machine | TODO | — | draft→revision→approved→published |
| Client manager notification | TODO | — | On draft created |
| Revision loop (inject review notes) | TODO | — | |
| 60-day follow-up scheduler | TODO | — | citation_rate_after capture |
| 50-piece Srinivas review session | TODO | — | Quality gate |
