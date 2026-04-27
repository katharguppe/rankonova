# TASK-002: Tenant & Client Management

## Status: IN PROGRESS
## Phase: 1
## Branch: feature/TASK-002
## Started: 2026-04-27

## Objective
Full tenant + client lifecycle per PRD F-02. All queries tenant-scoped via
TenantScopedPrismaService wrapper. Plan enforcement on client creation.

## Scope
- `app/common/` -- TenantScopedPrismaService, RolesGuard, Roles decorator
- `app/tenants/` -- Tenant CRUD + Client CRUD (tenant-scoped)

## Exit Criteria
- [ ] GET /tenants/me returns own tenant profile
- [ ] PATCH /tenants/me updates name and billingEmail
- [ ] POST /tenants/me/clients creates client; plan limit enforced
- [ ] GET/PATCH/DELETE /tenants/me/clients/:id are all tenant-scoped
- [ ] Soft delete sets deleted_at and is_active=false; data retained
- [ ] Super admin can list all tenants and change plan
- [ ] RolesGuard enforced on all endpoints
- [ ] Tenant isolation pen test: Tenant A cannot read Tenant B client (404)
- [ ] E2E suite passes

## Dependencies
- TASK-001 auth module (JwtAuthGuard, RequestUser)

## PDCA Log

### Cycle 1
**Plan:** TenantScopedPrismaService + RolesGuard + Tenant/Client CRUD + isolation E2E.
**Approved:** 2026-04-27
**Do:** In progress
**Check:** --
**Act:** --

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| feature/TASK-002 branch | DONE | -- | branched from feature/TASK-001 |
| TenantScopedPrismaService | TODO | -- | |
| RolesGuard + Roles decorator | TODO | -- | |
| Tenant CRUD (5 endpoints) | TODO | -- | |
| Client CRUD (5 endpoints) | TODO | -- | |
| E2E isolation pen test | TODO | -- | |
