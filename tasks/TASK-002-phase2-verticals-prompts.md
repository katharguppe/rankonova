# TASK-002: Phase 2 — Verticals and Prompts

## Status: IN PROGRESS
## Phase: 2
## Branch: feature/phase2-verticals (from feature/phase1-users)

## Objective
Vertical configuration engine (zero-code new vertical) and prompt library with daily quota enforcement via Redis. All 5 launch verticals seeded with full config. Minimum 60 prompts per vertical.

## Scope
- `src/verticals/` — vertical CRUD, config versioning, clone-from-existing
- `src/prompts/` — prompt library CRUD, platform vs tenant prompts, quota enforcement
- `prisma/seed/` — 5 vertical seed files + prompt library (300+ prompts)

## Exit Criteria
- [ ] All 5 verticals seeded: Automotive, Real Estate, HR Services, GCC Advisory, Healthcare
- [ ] Each vertical has full JSON config: prompt_templates, trusted_domains, aggregator_platforms, schema_types, community_platforms, review_platforms
- [ ] Vertical config change logged with before/after JSON diff
- [ ] New vertical can be cloned from existing via API
- [ ] Platform prompts: minimum 60 per vertical (300 total)
- [ ] Tenant custom prompts: create/edit/deactivate with is_custom flag
- [ ] Quota enforcement: Starter 500/day, Growth 5000/day via Redis counter
- [ ] 501st prompt run on Starter returns 429 with reset time header
- [ ] Redis key pattern: `quota:{tenantId}:{YYYY-MM-DD}` TTL 48h verified

## Dependencies
- TASK-001 exit criteria met
- Open Question #2: specific Indian aggregator URLs per vertical (Srinivas)

## PDCA Log

### Cycle 1
**Plan:** Vertical CRUD + config versioning (VerticalConfigAudit) + clone endpoint + 5 vertical seeds. Prompts deferred to separate session.
**Approved:** 2026-04-28 (aggregator URLs confirmed: CarDekho/ZigWheels, 99acres/MagicBricks, Naukri/AmbitionBox, NASSCOM/LinkedIn, Practo/JustDial; css_selectors left as TODO placeholders)
**Do:** Schema updated (intent_categories + VerticalConfigAudit model), DTOs, service, controller, module, seed file, E2E tests. Prisma client regenerated — 0 type errors, 0 lint errors.
**Check:** Pending migration + E2E run (DB must be up)
**Act:**

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Vertical entity CRUD | DONE | pending commit | app/verticals/ |
| Vertical config versioning | DONE | pending commit | VerticalConfigAudit, before/after JSON diff |
| Vertical clone endpoint | DONE | pending commit | POST /verticals/:id/clone |
| Vertical seeds (5) | DONE | pending commit | prisma/seed/verticals.seed.ts; css_selectors TODO |
| Vertical E2E tests | DONE | pending commit | test/verticals.e2e-spec.ts |
| Prompt entity CRUD | TODO | — | app/prompts/ session |
| Platform vs tenant prompt logic | TODO | — | tenant_id NULL = platform |
| Redis quota counter | TODO | — | TTL 48h |
| Quota enforcement guard | TODO | — | 429 + X-Quota-Reset header |
| Prompt seeds (300+) | TODO | — | 60+ per vertical |
| Quota E2E test | TODO | — | Test at limit and over limit |
