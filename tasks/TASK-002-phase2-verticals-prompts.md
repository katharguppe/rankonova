# TASK-002: Phase 2 — Verticals and Prompts

## Status: DONE
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
**Act:** Prompts sub-session complete. Commits 6acefcb5 + 6dc05445. PR to open after E2E run passes.

### Cycle 3 — Prompts E2E + Quota Endpoint
**Plan:** Add GET /prompts/quota endpoint; write 15-case E2E test suite covering auth, CRUD, tenant isolation, soft-deactivate, and quota status.
**Approved:** 2026-04-28
**Do:** Injected QuotaService into PromptsService; added getQuota(user) method; added GET /prompts/quota route (static, before :id); wrote test/prompts.e2e-spec.ts with 3 users (super_admin, tenant_admin, other tenant), test vertical created in DB, full cleanup in afterAll.
**Check:** tsc --noEmit clean. Run pending: `npx jest --testPathPattern=prompts --config test/jest-e2e.json` (DB + Redis required).
**Act:** TASK-002 fully code-complete. HEAD: 58d20d42. Next: feature/phase3-prompt-engine.

### Cycle 4 — E2E Reliability Fixes
**Plan:** Fix 3 E2E failures: (1) lockout.service clearFailures throws on missing user, (2) tenants afterAll vertical.delete throws on missing vertical, (3) beforeAll timeout 5000ms exceeded across all 4 suites + stale data 409s from crashed prior runs.
**Approved:** 2026-04-28
**Do:** (1) lockout.service.ts: update -> updateMany in clearFailures. (2) tenants.e2e-spec.ts: delete -> deleteMany for vertical in afterAll. (3) All 4 E2E files: 30s beforeAll timeout; slug-anchored pre-cleanup that walks tenant->users->authEvents/refreshTokens->clients and deletes by known slug, catching orphaned tenants whose users were already cleaned by a prior partial afterAll.
**Check:** `npm run test:e2e` -- 89/89 passed. Committed 3107acac, pushed to main.
**Act:** All E2E tests green. TASK-002 runtime-verified. main HEAD: 3107acac.

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
| E2E suite green (89/89) | DONE | 3107acac | lockout fix, 30s timeout, slug-anchored pre-cleanup all 4 files |
| CI lint clean | DONE | dd90cfff | remove unused _tokenB declaration + assignment from users.e2e-spec.ts |
