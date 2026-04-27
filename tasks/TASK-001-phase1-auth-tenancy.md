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

### Cycle 2 (post-DONE Docker fixes)
**Plan:** Fix two Docker runtime failures: bcrypt native binary crash, JWT_PUBLIC_KEY empty crash.
**Approved:** 2026-04-27
**Do:** 2 commits on feature/TASK-001
**Check:** Build clean, no TypeScript errors
**Act:** Committed and pushed

### Cycle 3 (bcryptjs E2E regression — RESOLVED)
**Plan:** POST /auth/register returns 500 in E2E after bcryptjs swap. Diagnose root cause.
**Approved:** 2026-04-27
**Do:** Diagnosis — no code change needed. Root cause was environmental: DB/Redis not running when tests were first executed after the swap.
**Check:** 32 tests passing (31 auth E2E + 1 health E2E) with Docker up.
**Act:** No fix commit required. TASK-001 fully closed.

### Cycle 4 (dev environment hardening)
**Plan:** Fix Docker Desktop WSL2 disk corruption, Thunder Client Invalid URL, tighten .dockerignore, add prod compose file.
**Approved:** 2026-04-27
**Do:** 3 commits — infra files only, no app code changes
**Check:** Scripts parse cleanly (ASCII-only), files committed and pushed
**Act:** DONE

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Auth module scaffold | DONE | 1ea85434 | JwtStrategy, AuthService, EncryptionService, LockoutService, AuthController |
| JWT RS256 sign/verify | DONE | 1ea85434 | Private key signs, public key verifies; keys base64-encoded in env |
| Refresh token rotation | DONE | 1ea85434 | SHA-256 hash in DB, raw token in httpOnly cookie |
| TOTP MFA enroll/challenge | DONE | 1ea85434 | otplib + AES-256-GCM encrypted secret at rest |
| Account lockout | DONE | 1ea85434 | 5 failures → 15 min lockout, DB-backed |
| Auth rate limiter | DONE | 1ea85434 | ThrottlerModule 10 req/60s on AuthController |
| Auth E2E suite | DONE | 10db646b | 27 cases -- all auth flows |
| ThrottlerGuard bypass fix | DONE | 365bebc5 | Override in main test app; isolated app for rate-limit test |
| Health E2E JWT env fix | DONE | 92435439 | generateKeyPairSync at file top, sets all 5 required env vars |
| bcrypt -> bcryptjs (Docker fix) | DONE | 46a4fc9c | Pure JS, no native binary; API identical |
| JWT fallback key in main.ts (Docker fix) | DONE | 2852a84d | seedDevKeys() before NestFactory.create(); ephemeral pair when JWT_PUBLIC_KEY unset |
| bcryptjs E2E regression | DONE | -- | Root cause: DB/Redis not running during test run. No code fix needed. 32/32 pass with Docker up. |
| docker-compose.prod.yml + dockerignore | DONE | 5683a02c | api service (prod target) in separate file; dockerignore tightened |
| Thunder Client collection | DONE | 5683a02c | thunder-tests/: environment.json + collection.json (10 auth endpoints) |
| WSL2 repair script + .wslconfig | DONE | dcdba240 | scripts/wsl-repair.ps1; .wslconfig: sparse, autoMemoryReclaim, kernelCommandLine |
| wsl-repair.ps1 ASCII fix | DONE | e9db0eb4 | Replaced all Unicode (em dash, arrows, box chars) with ASCII equivalents |
