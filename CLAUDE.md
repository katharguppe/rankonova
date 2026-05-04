# CLAUDE.md -- aeo-suite
# Extends ~/.claude/CLAUDE.md.

## Stack
NestJS, TypeScript 5.x, Prisma, PostgreSQL 15, Redis 7, Bull, Next.js 14 App Router, shadcn/ui, Tailwind, Docker

## Current Phase: 7 (complete) — next: Phase 8

## Phase 7 Handoff (2026-05-04, main HEAD: 85aeeab8)
  Content generators  : Cerebras (CEREBRAS_API_KEY), model llama3.1-8b, baseURL https://api.cerebras.ai/v1
  Generator fallback  : non-HTML response wrapped in minimal HTML shell (warn+wrap, never throw)
  Content UI (F-07)   : /dashboard/[clientId]/content — tabs, table, iframe preview, approve, revision
  Preview fix         : html_content included in listOutputs select; openPreview uses item.html_content directly
  19 content outputs  : in DB for stress client cmonwtk9r00002ku9q59ge1h4
  E2E suite           : 105/105 green (16 content-agent, mocked generators)
  Smoke script        : scripts/smoke-test-content-agent.ts — 10/10 generation + full workflow

## Module Boundaries
  Session -> auth	: app\auth\ only
  Session -> tenants	: app\tenants\ only
  Session -> users	: app\users\ only
  Session -> verticals	: app\verticals\ only
  Session -> clients	: app\clients\ only
  Session -> competitors	: app\competitors\ only
  Session -> prompts	: app\prompts\ only
  Session -> prompt-engine	: app\prompt-engine\ only
  Session -> extraction	: app\extraction\ only
  Session -> analytics	: app\analytics\ only
  Session -> diagnostics	: app\diagnostics\ only
  Session -> content-agent	: app\content-agent\ only
  Session -> offsite	: app\offsite\ only
  Session -> weekly-brief	: app\weekly-brief\ only
  Session -> billing	: app\billing\ only
  Session -> notifications	: app\notifications\ only
  Session -> admin	: app\admin\ only
  Session -> debug   : one error + one file per session

## Key Config
  Stress client ID : cmonwtk9r00002ku9q59ge1h4
  Demo user email  : demo@aeo-suite.local
  Demo password    : Demo@2026!
  Backend port     : 3000
  Frontend port    : 3001
  DB               : postgres://aeo:aeo_dev@127.0.0.1:5433/aeo_suite
  Redis            : redis://localhost:6379
  Auth response    : { accessToken: "..." }  (camelCase, not access_token)

## Git
  main / dev / feature/TASK-XXX
  Format: [TASK-XXX] verb: what changed
