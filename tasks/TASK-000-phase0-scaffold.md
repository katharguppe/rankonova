# TASK-000: Phase 0 — Foundation Scaffold

## Status: IN PROGRESS
## Phase: 0
## Branch: feature/TASK-000

## Objective
Establish the complete project foundation: NestJS monorepo scaffold, validated Prisma schema, Docker dev environment, CI/CD pipeline, and environment configuration. Every subsequent phase builds on this and must not start until exit criteria are met.

## Scope
- `prisma/schema/` — Prisma schema (all models, enums, indexes)
- `prisma.config.ts` — Prisma 7 datasource config
- `src/` — NestJS CLI scaffold with module stubs
- `docker-compose.yml` — PostgreSQL 15, Redis 7, app
- `Dockerfile` — multi-stage build
- `.env.example` — all variables documented
- `.github/workflows/ci.yml` — lint + test + build
- `CLAUDE.md` — project session context

## Exit Criteria
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `docker compose up` starts cleanly (postgres, redis, api all healthy)
- [ ] `npx prisma migrate dev` applies schema with zero errors
- [ ] `npm run test:e2e` passes (scaffold smoke test)
- [ ] CI pipeline green on push to feature/TASK-000

## PDCA Log

### Cycle 1 — Prisma Schema
**Plan:** Write complete Prisma schema per PRD Section 8. All 16 tables + auth support tables + enums + indexes.
**Approved:** Pending Srinivas review
**Do:** Schema written at `prisma/schema/schema.prisma`. Validated with `prisma validate` — passes clean. Prisma 7.8.0 compat: `url` removed from datasource, `prismaSchemaFolder` preview feature removed (now standard).
**Check:** 18 models, 13 enums, all tenant_id indexes present. `GapReport` self-ref, `Prompt` nullable tenant for platform prompts, soft-deletes on tenants/users/clients/competitors.
**Act:** Awaiting approval. Next: NestJS scaffold + prisma.config.ts.

### Cycle 2 — NestJS Scaffold
**Plan:**
**Approved:** Pending
**Do:**
**Check:**
**Act:**

### Cycle 3 — Docker + CI
**Plan:**
**Approved:** Pending
**Do:**
**Check:**
**Act:**

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Prisma schema written | DONE | — | `prisma/schema/schema.prisma`, validates clean |
| Prisma schema approved | PENDING | — | Awaiting Srinivas review |
| prisma.config.ts created | TODO | — | Prisma 7 requires adapter config at project root |
| NestJS CLI scaffold | TODO | — | `nest new aeo-suite --strict` |
| Module stubs (all 16) | TODO | — | Empty modules, no logic |
| docker-compose.yml | TODO | — | pg15 + redis7 + api |
| Dockerfile multi-stage | TODO | — | build + prod stages |
| .env.example | TODO | — | All vars from PRD Section 11 |
| CI workflow | TODO | — | lint, typecheck, test, build |
| E2E smoke test | TODO | — | Health endpoint returns 200 |
