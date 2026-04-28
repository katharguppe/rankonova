# TASK-002: Phase 2 — Verticals and Prompts

## Status: IN PROGRESS
## Phase: 2
## Branch: feature/phase2-verticals (from feature/phase1-users)

## Objective
Vertical configuration engine (zero-code new vertical) and prompt library with daily quota enforcement via Redis. All 5 launch verticals seeded with full config. Minimum 60 prompts per vertical.

## Scope
- `app/verticals/` — vertical CRUD, config versioning, clone-from-existing
- `app/prompts/` — prompt library CRUD, platform vs tenant prompts, quota enforcement
- `prisma/seed/` — 5 vertical seed files + prompt library (300+ prompts)

## Exit Criteria
- [x] All 5 verticals seeded: Automotive, Real Estate, HR Services, GCC Advisory, Healthcare
- [x] Each vertical has full JSON config: prompt_templates, intent_categories, trusted_domains, aggregator_platforms, schema_types, community_platforms, review_platforms
- [x] Vertical config change logged with before/after JSON diff
- [x] New vertical can be cloned from existing via API
- [x] Platform prompts: 64 per vertical × 5 = 320 total
- [x] Tenant custom prompts: create/edit/deactivate with is_custom flag
- [x] Quota enforcement: Starter 500/day, Growth 5000/day via Redis counter
- [x] 501st prompt run on Starter returns 429 with reset time header
- [x] Redis key pattern: `quota:{tenantId}:{YYYY-MM-DD}` TTL 48h (QuotaService)

## Dependencies
- TASK-001 exit criteria met ✓
- Open Question #2: aggregator URLs confirmed 2026-04-28 (css_selectors still TODO)

## PDCA Log

### Cycle 1 — Verticals
**Plan:** Vertical CRUD + config versioning (VerticalConfigAudit) + clone endpoint + 5 vertical seeds. Prompts deferred to separate session.
**Approved:** 2026-04-28 (aggregator URLs: CarDekho/ZigWheels, 99acres/MagicBricks, Naukri/AmbitionBox, NASSCOM/LinkedIn, Practo/JustDial; css_selectors left as TODO)
**Do:** Schema (intent_categories + VerticalConfigAudit), DTOs, service, controller, module, seed, E2E tests. Prisma client regenerated. Migration applied. Seed ran (5 verticals live). Branch pushed to origin.
**Check:** Migration 20260428052430_phase2_vertical_config_audit applied. Seed confirmed live. E2E tests written — run pending (`npx jest --testPathPattern=verticals`).
**Act:** Verticals sub-session complete. Proceed to prompts session on same branch.

### Cycle 2 — Prompts
**Plan:** Prompt CRUD + tenant-scoped access + Redis quota guard + 320 platform prompt seeds.
**Approved:** 2026-04-28
**Do:** DTOs, QuotaService (Redis counter), QuotaGuard (429 + X-RateLimit-Reset), PromptsService (6 methods), PromptsController (6 routes), PromptsModule (ioredis provider), prompts.seed.ts (64 × 5 = 320), seed/index.ts.
**Check:** `tsc --noEmit` clean, `nest build` clean, 320 prompt entries confirmed. Run pending: `npx ts-node prisma/seed/prompts.seed.ts` (DB must be up).
**Act:** Prompts sub-session complete. Commit 6acefcb5. Open PR after E2E pass.

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Vertical entity CRUD | DONE | 55583dea | app/verticals/ — CRUD, 7 routes |
| Vertical config versioning | DONE | 55583dea | VerticalConfigAudit, before/after JSON diff |
| Vertical clone endpoint | DONE | 55583dea | POST /verticals/:id/clone |
| Vertical seeds (5) | DONE | 57b87363 | prisma/seed/verticals.seed.ts; css_selectors TODO |
| Vertical E2E tests | DONE | 55583dea | test/verticals.e2e-spec.ts — 14 cases |
| DB migration applied | DONE | — | 20260428052030_phase2_vertical_config_audit |
| Prompt entity CRUD | DONE | 6acefcb5 | app/prompts/ — 6 routes |
| Platform vs tenant prompt logic | DONE | 6acefcb5 | tenant_id NULL = platform prompt |
| Redis quota counter | DONE | 6acefcb5 | quota:{tenantId}:{YYYY-MM-DD} TTL 48h |
| Quota enforcement guard | DONE | 6acefcb5 | 429 + X-RateLimit-Reset header |
| Prompt seeds (300+) | DONE | 6acefcb5 | 320 prompts (64/vertical), all intent/stage types |
| Quota E2E test | DONE | 6dc05445 | GET /prompts/quota + 15 E2E cases in test/prompts.e2e-spec.ts |
