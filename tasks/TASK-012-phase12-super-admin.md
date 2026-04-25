# TASK-012: Phase 12 — Super Admin

## Status: PLANNING
## Phase: 12
## Branch: feature/TASK-012 (create when TASK-011 exits)

## Objective
Full operational visibility and control for Srinivas / SherpaVector. Cross-tenant dashboard, system health, cost monitor, manual controls, billing overrides, read-only impersonation. Srinivas UAT sign-off required.

## Scope
- `src/admin/` — super_admin API endpoints (all cross-tenant operations)
- `frontend/app/admin/` — super admin UI (cross-tenant dashboard, health, cost, controls)

## Exit Criteria
- [ ] Cross-tenant dashboard: all tenants visible with plan, usage, MRR, health status
- [ ] Tenant detail: client count, runs today, cost today, last active
- [ ] Vertical management: full CRUD for all verticals and config
- [ ] Prompt library management: add/edit/deactivate platform prompts
- [ ] System health: queue depths, failed jobs, DLQ contents, Redis memory, DB pool, API key error rates per engine
- [ ] Cost monitor: total cost per engine per day, per tenant, trend chart
- [ ] Manual controls: trigger run, regenerate report, flush cache, force weekly brief
- [ ] Billing overrides: extend trial, apply discount, force plan change
- [ ] Read-only impersonation: view as any tenant_admin (no write actions possible)
- [ ] All super_admin endpoints require `super_admin` role (tested with other roles → 403)
- [ ] Srinivas UAT sign-off on all features

## Dependencies
- TASK-011 exit criteria met
- Open Question #9: SherpaVector white-label architecture (Srinivas)

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
| Cross-tenant tenant list API | TODO | — | |
| Tenant detail API | TODO | — | |
| Vertical CRUD (admin) | TODO | — | |
| Prompt library management (admin) | TODO | — | |
| System health endpoint | TODO | — | queue, Redis, DB, API keys |
| Cost monitor aggregation | TODO | — | Per engine, per tenant |
| Manual trigger endpoints | TODO | — | Run, report, cache, brief |
| Billing override endpoints | TODO | — | Trial extend, discount, plan |
| Impersonation (read-only) | TODO | — | JWT claim injection |
| Admin UI — tenant dashboard | TODO | — | |
| Admin UI — health + cost | TODO | — | |
| Admin UI — manual controls | TODO | — | |
| super_admin RBAC enforcement | TODO | — | 403 for all other roles |
| Srinivas UAT session | TODO | — | Sign-off required |
