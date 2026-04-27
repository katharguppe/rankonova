# TASK-001 Phase 1 (cont.) -- User CRUD, Invite Flow, Role Assignment

## Status: PLANNING
## Phase: 1
## Branch: feature/phase1-users (create from feature/TASK-002)
## Session script: .\aeo-suite-sessions.ps1 -Session users

## Naming Note
Users/RBAC is Phase 1 per PRD Section 10. TASK-003 number belongs to Phase 3
(Execution Engine). This file tracks the Phase 1 users session only; at completion
fold checkpoints into TASK-001-phase1-auth-tenancy.md and delete this file.

## Objective
User profile read, tenant user list, invite flow (email -> set password),
and role management. All queries scoped by tenant_id from JWT.

## Scope
- `app/users/` only -- dto/, users.service.ts, users.controller.ts, users.module.ts
- `test/users.e2e-spec.ts` -- 12-case E2E suite

## Endpoints
| Endpoint | Auth | Roles | Notes |
|---|---|---|---|
| GET /users/me | required | all | own profile |
| GET /users | required | tenant_admin | list own-tenant users |
| GET /users/:id | required | tenant_admin | single user, own tenant |
| POST /users/invite | required | tenant_admin | create invite token (48h Redis TTL) |
| POST /users/accept-invite | none | public | set password, activate user |
| PATCH /users/:id/role | required | tenant_admin | role change with guards |
| DELETE /users/:id | required | tenant_admin | soft deactivate (is_active=false) |

## DTOs
- `InviteUserDto` -- email, role (client_manager | client_viewer only, validated enum)
- `AcceptInviteDto` -- token, password (min 8, strength regex)
- `UpdateUserRoleDto` -- role (client_manager | client_viewer only)

## Service Guard Rules
- Cannot invite to super_admin -> 400
- Cannot promote to super_admin -> 400
- Cannot deactivate or change role of self -> 400
- PATCH /:id/role and DELETE /:id scoped to own tenant; foreign tenant -> 404

## E2E Plan (12 cases)
1. GET /users/me -> 200 own profile
2. GET /users -> 200 list (only own tenant users)
3. POST /users/invite -> 201 inviteToken returned
4. POST /users/accept-invite -> 200 user activated
5. Login as invited user -> 200
6. PATCH /users/:id/role -> 200 role updated
7. DELETE /users/:id -> 204 deactivated
8. [ISOLATION] Tenant A cannot GET Tenant B user by id -> 404
9. [ISOLATION] Tenant A cannot PATCH role of Tenant B user -> 404
10. [EDGE] DELETE /users/me (self) -> 400
11. [EDGE] Invite to super_admin role -> 400
12. [EDGE] PATCH role to super_admin -> 400

## Exit Criteria
- [ ] GET /users/me returns own profile for all roles
- [ ] GET /users lists only own-tenant users (tenant_admin)
- [ ] Invite flow: user created inactive, token in Redis, accept sets password + activates
- [ ] Invited user can log in after accepting
- [ ] Role change works within own tenant, rejects super_admin target
- [ ] Deactivate works, cannot deactivate self
- [ ] Tenant isolation: cross-tenant access -> 404 on all mutating endpoints
- [ ] TypeScript build passes (0 errors)
- [ ] All 12 E2E cases pass

## Dependencies
- feature/TASK-002 (TenantScopedPrismaService, RolesGuard, JwtAuthGuard)

## PDCA Log

### Cycle 1
**Plan:** Presented 2026-04-27. Awaiting approval.
**Approved:** Pending
**Do:** --
**Check:** --
**Act:** --

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| feature/phase1-users branch | TODO | -- | create from feature/TASK-002 |
| DTOs (invite, accept, role) | TODO | -- | |
| UsersService (7 methods) | TODO | -- | |
| UsersController (7 endpoints) | TODO | -- | |
| UsersModule wired | TODO | -- | imports CommonModule |
| E2E suite (12 cases) | TODO | -- | |
| Build verification | TODO | -- | |
| Fold into TASK-001-phase1-auth-tenancy.md | TODO | -- | delete this file after |
