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

### Cycle 2
**Plan:** FAQ Page generator (Claude Sonnet via OpenRouter) + quality validator (6 rules). Wire into service + controller.
**Approved:** 2026-05-03
**Do:** generators/faq-page.generator.ts, validators/quality-validator.ts, content-agent.types.ts, dto/generate-content.dto.ts, updated service + controller + module.
**Check:** Backend typecheck clean.
**Act:** Committed. Ready for Cycle 3 (remaining 3 content types).

### Cycle 3
**Plan:** Comparison Page + Entity Authority Page + Segment Article generators. Update validator with ContentType dispatch + 3 type-specific checks. Service dispatches all 4 types.
**Approved:** 2026-05-03
**Do:** generators/comparison-page.generator.ts, generators/entity-authority-page.generator.ts, generators/segment-article.generator.ts; updated validator + service + module.
**Check:** Backend typecheck clean.
**Act:** Committed. Ready for Cycle 4 (approval state machine + controller endpoints).

### Cycle 4
**Plan:** Approval state machine (draft→revision→approved→published), regenerate with review notes, 60-day follow-up @Cron, client_manager notification on draft. 4 new controller endpoints.
**Approved:** 2026-05-03
**Do:** revisionNotes added to all 4 generators; dto/request-revision.dto.ts; full service rewrite with approveOutput, requestRevision, regenerateOutput, publishOutput, runFollowUpCapture; updated controller.
**Check:** Backend typecheck clean.
**Act:** Committed. Ready for Cycle 5 (smoke tests + CLAUDE.md phase update).

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Prisma schema + migration | DONE | c044d188 | +follow_up_scheduled_at, +previous_version_id self-rel |
| FAQ Page generator | DONE | — | generators/faq-page.generator.ts — Claude Sonnet via OpenRouter |
| JSON-LD validator | DONE | — | validators/quality-validator.ts — all 6 checks |
| Answer rules validator | DONE | — | word count 50-90, specific number required |
| Blocked phrases checker | DONE | — | 11 phrases with replacement suggestions |
| HTML validator | DONE | — | structural tags + schema block count |
| Comparison Page generator | DONE | — | generators/comparison-page.generator.ts — table check, FAQPage + secondary schema |
| Entity Authority Page generator | DONE | — | generators/entity-authority-page.generator.ts — VERTICAL_SCHEMA_TYPES map, Wikidata facts |
| Segment Article generator | DONE | — | generators/segment-article.generator.ts — 1200-1800w, HowTo/Article schema |
| Approval workflow state machine | DONE | — | VALID_TRANSITIONS map; assertValidTransition on every state change |
| Client manager notification | DONE | — | notifyDraftCreated() — Notification record on generate + regenerate |
| Revision loop (inject review notes) | DONE | — | regenerateOutput() — revisionNotes injected into all 4 generators |
| 60-day follow-up scheduler | DONE | — | @Cron EVERY_DAY_AT_2AM — captures citation_rate_after on due outputs |
| 50-piece Srinivas review session | TODO | — | Quality gate |
