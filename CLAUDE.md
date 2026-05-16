# CLAUDE.md -- aeo-suite
# Extends ~/.claude/CLAUDE.md.

## Stack
NestJS, TypeScript 5.x, Prisma, PostgreSQL 15, Redis 7, Bull, Next.js 14 App Router, shadcn/ui, Tailwind, Docker

## Current Status
  Last Completed : fix-prisma-types (pre-flight cleanup, 2026-05-16)
  Next Task      : fix-perplexity (session order 2 of 17)
  tsc errors     : 0
  Jest           : 32/32 suites, 295/295 tests passing
  HEAD           : a4723da

## Session Log (most recent first)
  fix-prisma-types  ✅  a4723da  2026-05-16  32/32 tests, 0 tsc errors — see docs/checkpoints/ck01.md
  fix-models        ✅  381b625  2026-05-16  Anthropic SDK per PRD model routing
  [Phases 0–12 archived → docs/checkpoints/phase-history.md]

## 17-Session Roadmap
  01  fix-models        ✅  Replace Cerebras with Anthropic SDK per PRD
  02  fix-perplexity        Direct Perplexity API (sonar model, https://api.perplexity.ai)
  03  fix-gemini            Gemini adapter — verify/update model string + SDK usage
  04  fix-chatgpt           ChatGPT adapter — verify/update model string + SDK usage
  05  fix-claude-adapter    Claude adapter in prompt-engine — verify model routing
  06  fix-extraction        Extraction pipeline — end-to-end smoke + error handling
  07  fix-content-agent     Content agent — full smoke + quality validator wiring
  08  fix-scheduler         Scheduler agent — batch loop, dead-letter, iteration tick
  09  fix-analytics         Analytics services — citation, SOV, anomaly, dashboard
  10  fix-offsite           Offsite modules — aggregator, reviews, community, KG, PR
  11  fix-weekly-brief      Weekly brief pipeline — smoke + email sender
  12  fix-billing           Billing — Razorpay live key wiring + E2E smoke
  13  fix-notifications     Notifications — digest cron, rate limiter, handlers
  14  fix-admin             Admin module
  15  fix-frontend          Frontend — dashboard, content UI, new-client form
  16  fix-e2e               Full E2E suite — clients, auth, content workflow
  17  fix-seed              Seed scripts — prompts, competitors, verticals

## Module Boundaries
  Session -> auth          : app/auth/ only
  Session -> tenants       : app/tenants/ only
  Session -> users         : app/users/ only
  Session -> verticals     : app/verticals/ only
  Session -> clients       : app/clients/ only
  Session -> competitors   : app/competitors/ only
  Session -> prompts       : app/prompts/ only
  Session -> prompt-engine : app/prompt-engine/ only
  Session -> extraction    : app/extraction/ only
  Session -> analytics     : app/analytics/ only
  Session -> diagnostics   : app/diagnostics/ only
  Session -> content-agent : app/content-agent/ only
  Session -> offsite       : app/offsite/ only
  Session -> weekly-brief  : app/weekly-brief/ only
  Session -> billing       : app/billing/ only
  Session -> notifications : app/notifications/ only
  Session -> admin         : app/admin/ only
  Session -> debug         : one error + one file per session

## Key Config
  Stress client ID : cmonwtk9r00002ku9q59ge1h4
  Demo user email  : demo@aeo-suite.local
  Demo password    : Demo@2026!
  Backend port     : 3000
  Frontend port    : 3001
  DB               : postgres://aeo:aeo_dev@127.0.0.1:5433/aeo_suite
  Redis            : redis://localhost:6379
  Auth response    : { accessToken: "..." }  (camelCase, not access_token)

## Model Routing (application code — do not deviate)
  claude-haiku-4-5-20251001  : extraction, quota checks, seed scripts, config changes
  claude-sonnet-4-20250514   : content generation, gap summaries, PR drafts, reasoning

## Known Issues
  - Razorpay live API keys not yet provided (RAZORPAY_STUB=true) — blocks billing full cycle
  - Perplexity adapter is a NotImplementedException stub — fix-perplexity session (02) will resolve

## Git
  main / dev / feature/TASK-XXX
  Commit format  : [TASK-XXX] verb: what changed
  Checkpoint fmt : [CK-XX] checkpoint: <step> - verified
