# TASK-002: Phase 2 — Verticals and Prompts

## Status: PLANNING
## Phase: 2
## Branch: feature/TASK-002 (create when TASK-001 exits)

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
**Plan:**
**Approved:** Pending
**Do:**
**Check:**
**Act:**

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Vertical entity CRUD | TODO | — | |
| Vertical config versioning | TODO | — | Before/after diff in audit log |
| Vertical clone endpoint | TODO | — | |
| Prompt entity CRUD | TODO | — | |
| Platform vs tenant prompt logic | TODO | — | tenant_id NULL = platform |
| Redis quota counter | TODO | — | TTL 48h |
| Quota enforcement guard | TODO | — | 429 + X-Quota-Reset header |
| Automotive seed | TODO | — | 60+ prompts, full vertical config |
| Real Estate seed | TODO | — | 60+ prompts, full vertical config |
| HR Services seed | TODO | — | 60+ prompts, full vertical config |
| GCC Advisory seed | TODO | — | 60+ prompts, full vertical config |
| Healthcare seed | TODO | — | 60+ prompts, full vertical config |
| Quota E2E test | TODO | — | Test at limit and over limit |
