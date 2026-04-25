# CLAUDE.md -- aeo-suite
# Extends ~/.claude/CLAUDE.md.

## Stack
NestJS, TypeScript 5.x, Prisma, PostgreSQL 15, Redis 7, Bull, Next.js 14 App Router, shadcn/ui, Tailwind, Docker

## Current Phase: 0

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
[Fill in: env vars, thresholds, IDs, endpoints]

## Git
  main / dev / feature/TASK-XXX
  Format: [TASK-XXX] verb: what changed
