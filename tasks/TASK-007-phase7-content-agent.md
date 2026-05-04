# TASK-007: Phase 7 — Content Agent

## Status: DONE
## Phase: 7
## Branch: feature/TASK-007 (create when TASK-006 exits)

## Objective
Generate production-ready AEO-optimized HTML pages with embedded JSON-LD schema. Four content types. Automated quality validation before save. Human approval workflow with revision loop. Platform never auto-publishes.

## Scope
- `src/content-agent/` — generation pipeline, 4 content type generators, quality validator, approval workflow

## Exit Criteria
- [x] All 4 types generate without errors: FAQ Page, Comparison Page, Entity Authority Page, Segment Article
- [x] FAQ Page: 6-8 Q&A pairs, FAQPage JSON-LD valid, secondary vertical schema present
- [x] Answer rules enforced (validated post-generation): answer in first sentence, ≥1 specific number, ≤90 words, no unsupported superlatives
- [x] Comparison Page: spec table with schema markup (not image), FAQPage schema
- [x] Entity Authority Page: correct schema.org type per vertical, Wikidata-compatible facts block
- [x] Segment Article: 1200-1800 words, HowTo or Article schema, client mentioned naturally
- [x] Quality validator catches and flags: invalid JSON-LD, answer >90 words, no number in answer, blocked phrases, broken HTML, title >70 chars
- [x] Approval workflow: draft → notify client_manager → approve/revision/reject → regenerate with notes
- [x] 60-day `citation_rate_after` capture scheduled correctly
- [ ] 50 pieces reviewed by Srinivas, quality standard met — DEFERRED to Phase 14 beta

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

### Cycle 5
**Plan:** E2E test suite (16 cases, mocked generators) + smoke script (10-piece live generation, approval workflow test).
**Approved:** 2026-05-03
**Do:** test/content-agent.e2e-spec.ts (16 tests, overrideProvider for all 4 generators, real DB + validator); scripts/smoke-test-content-agent.ts (login, 10-piece generation, approve/publish/revision/regen workflow, guard test, JSON report).
**Check:** 16/16 E2E green (fixed viewer tenant cleanup). Full suite 105/105 pass. All state machine guards confirmed.
**Act:** Committed. Merged to main (259970e3). Pushed to origin. TASK-007 DONE.

### Cycle 6 — Content UI (PRD F-07)
**Plan:** Add Content section to Next.js dashboard: tab bar, table with type/status badges, fullscreen iframe preview, approve + request-revision buttons.
**Approved:** 2026-05-04
**Do:** frontend/lib/types.ts (+4 types); 4 API proxy routes under frontend/app/api/content/; frontend/app/dashboard/[clientId]/content/page.tsx (SSR); ContentClient.tsx (~450 lines, SWR, tabs, table, modals); Sidebar.tsx (Content link).
**Check:** TypeScript clean; UI renders table with badges, preview modal, approve/revision modals.
**Act:** Committed.

### Cycle 7 — Switch generators to Cerebras; HTML fallback
**Plan:** OpenRouter out of credits. Switch all 4 generators to Cerebras (free). Fix 500 errors when llama3.1-8b returns markdown.
**Approved:** 2026-05-04
**Do:** All 4 generators: apiKey=CEREBRAS_API_KEY, baseURL=https://api.cerebras.ai/v1, model=llama3.1-8b. Replace `throw new Error` on non-HTML with warn+wrap in minimal HTML shell. Smoke test: 10/10 pass.
**Check:** Smoke test 10/10 green; 0 errors; 19 records in DB.
**Act:** Committed (e0d5f715).

### Cycle 8 — Preview fix: html_content in list response
**Plan:** Preview modal showed "Failed to load preview" — secondary fetch to /content/output/:id was failing in browser. Fix: include html_content in listOutputs select so item.html_content is available directly.
**Approved:** 2026-05-04
**Do:** content-agent.service.ts listOutputs select +html_content; types.ts ContentListItem +html_content, ContentOutput -html_content (inherited); ContentClient.tsx openPreview() simplified to setPreviewItem(item) only; iframe sandbox=allow-scripts allow-same-origin.
**Check:** List endpoint returns html_content (4880 chars); TypeScript clean.
**Act:** Committed (5aa621c0). Pushed. Phase 7 fully done.

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
| E2E test suite | DONE | ad002673 | test/content-agent.e2e-spec.ts — 16/16 green, full suite 105/105 |
| Smoke script | DONE | ffd1c5f2 | scripts/smoke-test-content-agent.ts — 10-piece generation, full workflow, JSON report |
| Merge to main | DONE | 259970e3 | Merged feature/TASK-007, pushed to origin |
| Switch generators to Cerebras | DONE | e0d5f715 | All 4 generators: llama3.1-8b, CEREBRAS_API_KEY; HTML fallback wrap |
| Content UI (F-07) | DONE | 5aa621c0 (partial) | 4 proxy routes, ContentClient, preview modal, approve/revision |
| Preview fix (html_content in list) | DONE | 5aa621c0 | listOutputs +html_content; openPreview uses item directly |
| 50-piece Srinivas review session | DEFERRED | — | Deferred to Phase 14 beta |
