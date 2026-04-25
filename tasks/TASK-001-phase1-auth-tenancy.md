# TASK-001: Phase 1 — Auth and Tenancy

## Status: PLANNING
## Phase: 1
## Branch: feature/TASK-001 (create when TASK-000 exits)

## Objective
Production-grade authentication and multi-tenant isolation. JWT RS256 with refresh rotation, TOTP MFA, account lockout, and full RBAC. Every query scoped by tenant_id via TypeScript wrapper — not application logic.

## Scope
- `src/auth/` — JWT guards, RS256 signing, refresh rotation, TOTP MFA, lockout, rate limiting
- `src/tenants/` — tenant CRUD, plan enforcement stub, slug management
- `src/users/` — user CRUD, invite flow, role assignment
- `src/common/` — TenantScopedPrisma wrapper type, RBAC guards, interceptors

## Exit Criteria
- [ ] Registration + email verification flow passes E2E
- [ ] Login issues access token (24h) + refresh token (30d httpOnly cookie)
- [ ] Refresh rotation: new token issued, previous invalidated
- [ ] TOTP MFA enroll + challenge + recovery E2E pass
- [ ] 5 failed logins trigger 15-minute lockout (E2E verified)
- [ ] Rate limit: 11th auth request in 1 minute returns 429
- [ ] Tenant A cannot read tenant B data (penetration test: direct ID substitution blocked)
- [ ] All 4 roles (super_admin, tenant_admin, client_manager, client_viewer) enforced on sample endpoints
- [ ] All auth events written to `auth_events` table

## Dependencies
- TASK-000 exit criteria met

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
| RS256 key pair generation | TODO | — | Keys in env, never in repo |
| JWT service (sign/verify) | TODO | — | |
| Auth controller (register/login/refresh/logout) | TODO | — | |
| Refresh token rotation | TODO | — | Invalidate previous on use |
| TOTP MFA (enroll/challenge) | TODO | — | Google Authenticator compatible |
| Account lockout logic | TODO | — | 5 failures, 15 min TTL in Redis |
| Auth rate limiter | TODO | — | 10 req/min per IP, throttler module |
| Tenant CRUD | TODO | — | |
| User CRUD + invite | TODO | — | |
| TenantScopedPrisma wrapper | TODO | — | TypeScript type enforcement |
| RBAC guards | TODO | — | Decorator-based per endpoint |
| Auth E2E test suite | TODO | — | |
| Tenant isolation penetration test | TODO | — | |
