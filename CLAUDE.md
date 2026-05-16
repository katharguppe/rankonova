# CLAUDE.md -- aeo-suite
# Extends ~/.claude/CLAUDE.md.

## Stack
NestJS, TypeScript 5.x, Prisma, PostgreSQL 15, Redis 7, Bull, Next.js 14 App Router, shadcn/ui, Tailwind, Docker

## SESSION fix-models COMPLETE ✅ (2026-05-16)
  Commit: 381b625
  Replaced Cerebras llama3.1-8b with Anthropic SDK models per PRD:
    - extraction-haiku.service.ts → claude-haiku-4-5-20251001
    - faq-page, comparison-page, entity-authority-page, segment-article generators → claude-sonnet-4-20250514
    - perplexity.adapter.ts → NotImplementedException stub (fix-perplexity session next)
  Next session: fix-perplexity (order 2 of 17)

## Current Phase: 12 Complete ✅ (2026-05-16)

## TASK-012 Enhanced Client Onboarding ? (2026-05-16)
  4 new optional fields added to Client entity + frontend form extended

  Final commit     : 022a3229 (main)
  Completion date  : 2026-05-16

  New fields       : digital_handles (Json), brand_description (String), brand_keywords (Json), competitors_known (Json)
  Migration        : 20260516065553_add_client_brand_profile (additive, no breaking changes)
  API              : PATCH /clients/:id/profile � update profile fields after creation
  DTO              : UpdateClientProfileDto + CreateClientDto extended (tenants module)
  Frontend         : new-client form extended with "Brand Profile (Optional)" section
  Tests            : 9/9 passing (7 unit + 2 E2E)
  Build status     : ? 0 tsc errors, production build succeeds

  Key fixes during implementation:
    - POST endpoint was in /tenants/me/clients (not /clients)
    - TenantScopedPrismaService.createClient() type extended with new fields
    - Frontend field names corrected to snake_case

## Current Phase: 10 Complete ? (2026-05-13, pending live Razorpay API keys from Sir)
  Final commit: e3114ba3 � trial auto-start wired to AuthService.register (Phase 10 exit criterion met)

## Competitor Extraction Pipeline ? (2026-05-14)
  TASK-004 follow-up: Full CRUD, seeding, hierarchical matching for competitor resolution
  
  Commit           : 87facba1 (main)
  Completion date  : 2026-05-14
  
  CompetitorsService    : Full CRUD (create, list, update, soft-delete) + idempotent seeding
  CompetitorsController : REST endpoints with tenant scoping & role-based access (POST/GET/PATCH/DELETE)
  Seed data             : 50 baseline competitors, 10 per vertical (automotive, real_estate, hr_services, gcc_advisory, healthcare)
  ExtractionResolver    : Hierarchical matching (exact ? substring ? partial alias) for robust brand resolution
  Modules               : CompetitorsModule imports PrismaModule; VerticalsModule imports CompetitorsModule
  
  Test coverage         : 15 service unit tests + 17 resolver unit tests + 6 integration tests (38 total)
  Test results          : 204/204 passing (all suites, no regressions)
  Build status          : ? Production build succeeds (0 tsc errors)
  
  Key features:
    - Competitors auto-resolve during extraction via hierarchical matching
    - Tenant-scoped CRUD with authorization (super_admin, tenant_admin, client_manager)
    - Resilient seeding: continues on partial failure, skips if 10+ competitors exist
    - Real-world test cases: automotive, real estate, HR, healthcare brands

## Prompt Library (2026-05-13)
  Platform prompts trimmed to 10 per vertical (was 64) as per Sir's instruction.
  Selection: 8 � priority=10 (one per intent type, decision stage) + 2 � priority=9 (purchase_intent + comparison).
  Seed file  : prisma/seed/prompts.seed.ts � skip guard updated to >= 50
  DB script  : scripts/trim-prompts.ts � cascade-deletes brand_mentions ? prompt_runs ? prompts for removed rows
  Commit     : fe528bf0
  Totals     : 50 platform prompts (5 verticals � 10), 270 deleted

## Phases 0-9 Complete ? (2026-05-12)
  All phases from initial setup through Phase 9 have been merged to main.
  main HEAD: 4e768b4f
  
## Phase 9 Complete (2026-05-12, main HEAD: 4e768b4f)
  Weekly Brief Pipeline Step 9 � Content Draft Auto-Generation merged and CI fixed:
  
  TASK-009 Implementation:
    Feature branch   : feature/TASK-009 (merged to main 2026-05-12)
    Commits          : c2dd6b0c..4e768b4f (6 total, including CI fix)
    
    Step 9 Auto-Gen  : DownstreamTrigger.triggerContentDraftsForWorstPrompts()
    Identify         : 3 worst-performing prompts by citation rate (past 30 days)
    Generate         : 1 FAQ page per prompt via ContentAgentService.generateContent()
    Parallel exec    : Promise.allSettled() � all 3 run concurrently
    Error handling   : Log failures per prompt, don't break pipeline (resilient)
    Thread tenantId  : WeeklyBriefService ? DownstreamTrigger ? ContentAgentService
    
    Test status      : 103/103 passing (24/24 weekly-brief suite, 8 suites total)
    Code review      : Approved � spec compliant, no regressions
    Build status     : ? Production build succeeds
    CI fixes         : tsconfig.json + lint errors resolved; all CI steps passing
    
## Phase 10 Complete ? (2026-05-13, main HEAD: e3114ba3)
  Billing Module � all 17 tasks done + trial auto-start on registration, 166/166 jest passing, 0 tsc errors:

  TASK-010 Implementation:
    Branch           : main (committed directly)
    Final commit     : e3114ba3 (trial wired to registration � Phase 10 exit criterion)
    Test status      : 166/166 passing (21 suites, includes 7 new billing E2E tests)

  Services shipped  : PlanEnforcementService, SubscriptionService, TrialService,
                      InvoiceService, WebhookService, BillingService (orchestrator)
  Guard             : BillingGuard (global, 402 on suspended tenants)
  Processors        : trial.processor, payment-retry.processor, tenant-purge.processor
  Controller        : 6 endpoints (subscribe, cancel, plan, trial/start, status, webhook/razorpay)
  E2E tests         : app/billing/__tests__/billing.e2e.spec.ts � 3 scenarios, 7 assertions
  Webhook           : timing-safe HMAC, payment.captured / subscription.halted / subscription.cancelled
  Invoice           : pdfkit PDF emailed on payment success
  Trial             : 14-day Growth, D+7/D+12/D+14 email sequence, ends ? Starter
  Failed payment    : retry D+1/D+3/D+7, suspend tenant on D+7 no recovery
  Cancellation      : self-serve, billing_suspended=true, 90-day purge job scheduled

  Remaining blocker : Razorpay live API keys from Sir (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
                      RAZORPAY_WEBHOOK_SECRET) to flip RAZORPAY_STUB=false and run full cycle

## Phase 8 Complete (2026-05-05, merged to main 2026-05-11/12)
  All 5 Offsite modules shipped under app\offsite\:

  Module A � Aggregator Profile Monitor
    Service  : app\offsite\aggregator\aggregator.service.ts
    Cron     : EVERY_DAY_AT_2AM � Playwright scrape of aggregator profiles
    Smoke    : scripts/smoke-test-aggregator.ts � PASS

  Module B � Review Velocity Manager
    Service  : app\offsite\reviews\reviews.service.ts
    Cron     : EVERY_DAY_AT_3AM (audit) + EVERY_HOUR (negative scan)
    Models   : ReviewAudit, ReviewSnapshot, ReviewRequestKit (SVG QR code)
    Smoke    : scripts/smoke-test-reviews.ts

  Module C � Community Presence Monitor
    Service  : app\offsite\community\community.service.ts
    Cron     : EVERY_DAY_AT_4AM � Reddit JSON API (500ms delay) + Playwright fallback
    Model    : CommunityThread (competitor signal detection, draft gen)
    Smoke    : scripts/smoke-test-community.ts � PASS

  Module D � Knowledge Graph Entity Manager
    Service  : app\offsite\knowledge-graph\knowledge-graph.service.ts
    Cron     : '0 5 1 * *' (monthly) � Wikidata SPARQL + GKP Playwright + Wikipedia inlinks
    Model    : EntityCheck (wikidata_found, gkp_detected, wikipedia_notable, status_changed)
    Smoke    : scripts/smoke-test-knowledge-graph.ts � PASS

  Module E � PR Signal Generator
    Service  : app\offsite\pr\pr.service.ts
    Cron     : EVERY_6_HOURS (RSS scan) + EVERY_DAY_AT_6AM (pickup check)
    Models   : PrSignal, PrPickup (PrSignalStatus: draft?approved?distributed?archived)
    RSS lib  : fast-xml-parser v5.7.3 (RSS 2.0 + Atom, cdataPropName)
    Pickup   : Playwright Google site:domain search against vertical trusted_domains
    Smoke    : scripts/smoke-test-pr.ts

  JWT fix   : scripts/fix-jwt-keys.js � generates + verifies matched RS256-2048 pair, writes to .env
  Vertical  : news_rss_feeds Json? added; Automotive + Healthcare seeded with RSS feeds

  Post-Phase-8 cleanup (merged to main 2026-05-11/12):
    Mail service      : app\mail\mail.service.ts � nodemailer SMTP (SMTP_HOST/PORT/USER/PASS/FROM), sendVerificationEmail; wired to auth module
    Run Prompts UI    : POST /prompt-engine/clients/:clientId/run-all + frontend PromptsClient.tsx "Run Prompts" button + sonner Toaster
    Cerebras engines  : AiEngine.cerebras added to DEFAULT_ENGINES + SCHEDULED_ENGINES (was missing from daily batch)
    Seed fix          : prompts.seed.ts backfills null vertical_id for 320 platform prompts (root cause: vertical lookup ran after insert)
    TASK-007 validators: answer_indirect_opening, bare_superlative (11 patterns), howto_schema_missing, wikidata_facts_missing, blocked_phrase (11 phrases), FILLER_OPENER_RES pre-compiled
    State machine     : rejectOutput added (draft?rejected); PATCH /content/output/:id/reject endpoint; 58 unit specs total
    TASK-007 open     : "segment_article mentions client naturally" (prompt-level only) + UI Generate button (/dashboard/[clientId]/content)

## Phase 7 Handoff (2026-05-04, main HEAD: ebb71cd8)
  Content generators  : Cerebras (CEREBRAS_API_KEY), model llama3.1-8b, baseURL https://api.cerebras.ai/v1
  Generator fallback  : non-HTML response wrapped in minimal HTML shell (warn+wrap, never throw)
  Content UI (F-07)   : /dashboard/[clientId]/content � tabs, table, iframe preview, approve, revision
  Preview fix         : html_content included in listOutputs select; openPreview uses item.html_content directly
  19 content outputs  : in DB for stress client cmonwtk9r00002ku9q59ge1h4
  E2E suite           : 105/105 green (16 content-agent, mocked generators)
  Smoke script        : scripts/smoke-test-content-agent.ts � 10/10 generation + full workflow

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
