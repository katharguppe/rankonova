# TASK-001: Phase 1 — Auth and Tenancy

## Status: DONE
## Phase: 1
## Branch: feature/TASK-001
## Completed: 2026-04-27

## Objective
Production-grade authentication and multi-tenant isolation. JWT RS256 with refresh rotation, TOTP MFA, account lockout, and full RBAC. Every query scoped by tenant_id via TypeScript wrapper — not application logic.

## Scope (Auth subset — delivered this task)
- `app/auth/` — JWT guards, RS256 signing, refresh rotation, TOTP MFA, lockout, rate limiting
- `test/auth.e2e-spec.ts` — 27-case E2E suite
- `test/health.e2e-spec.ts` — JWT env seeding fix

## Scope (deferred to future tasks)
- `app/tenants/` — tenant CRUD, plan enforcement stub, slug management
- `app/users/` — user CRUD, invite flow, role assignment
- `app/common/` — TenantScopedPrisma wrapper type, RBAC guards, interceptors

## Exit Criteria
- [x] Registration + email verification flow passes E2E
- [x] Login issues access token (24h) + refresh token (30d httpOnly cookie)
- [x] Refresh rotation: new token issued, previous invalidated
- [x] TOTP MFA enroll + challenge + recovery E2E pass
- [x] 5 failed logins trigger 15-minute lockout (E2E verified)
- [x] Rate limit: 11th auth request in 1 minute returns 429
- [x] All auth events written to `auth_events` table
- [ ] Tenant A cannot read tenant B data — deferred (tenants session)
- [ ] All 4 roles enforced on sample endpoints — deferred (users session)

## Dependencies
- TASK-000 exit criteria met ✓

## PDCA Log

### Cycle 1
**Plan:** Implement JWT RS256 auth module with all auth flows, MFA, lockout, rate limiting, refresh rotation. Write 27-case E2E suite. Fix health E2E JWT env issue.
**Approved:** 2026-04-27
**Do:** 4 commits on feature/TASK-001
**Check:** CI green — all auth E2E (27 cases) and health E2E pass
**Act:** Marked DONE

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Auth module scaffold | DONE | 1ea85434 | JwtStrategy, AuthService, EncryptionService, LockoutService, AuthController |
| JWT RS256 sign/verify | DONE | 1ea85434 | Private key signs, public key verifies; keys base64-encoded in env |
| Refresh token rotation | DONE | 1ea85434 | SHA-256 hash in DB, raw token in httpOnly cookie |
| TOTP MFA enroll/challenge | DONE | 1ea85434 | otplib + AES-256-GCM encrypted secret at rest |
| Account lockout | DONE | 1ea85434 | 5 failures → 15 min lockout, DB-backed |
| Auth rate limiter | DONE | 1ea85434 | ThrottlerModule 10 req/60s on AuthController |
| Auth E2E suite | DONE | 10db646b | 27 cases — all auth flows |
| ThrottlerGuard bypass fix | DONE | 365bebc5 | Override in main test app; isolated app for rate-limit test |
| Health E2E JWT env fix | DONE | 92435439 | generateKeyPairSync at file top, sets all 5 required env vars |
