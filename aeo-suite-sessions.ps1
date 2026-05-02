# ==============================================================================
# aeo-suite-sessions.ps1
# AEO Suite -- Claude Code Session Launcher
# Owner: Srinivas / Fidelitus Corp / SherpaVector
# PRD: v2.1 April 2026
# Usage: .\aeo-suite-sessions.ps1 -Session <name>
#        .\aeo-suite-sessions.ps1 -Session list
# ==============================================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet(
        "schema","auth","tenants","users","verticals","clients","competitors",
        "prompts","prompt-engine","extraction","analytics","diagnostics",
        "content-agent","offsite","weekly-brief","billing","notifications",
        "admin","frontend","debug","list"
    )]
    [string]$Session
)

$PROJECT_ROOT = "D:\staging\aeo-suite"
$HAIKU        = "claude-haiku-4-5-20251001"
$SONNET       = "claude-sonnet-4-6"

# -- SESSION DEFINITIONS -------------------------------------------------------
$sessions = @{

    # -- Phase 0 ---------------------------------------------------------------
    schema = @{
        model = $SONNET
        task  = "TASK-000"
        label = "Phase 0 . Prisma Schema"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, PostgreSQL 15, Redis 7
Task file: tasks/TASK-000-phase0-scaffold.md
Module scope: prisma/schema/ ONLY.

Objective: Write the complete Prisma schema per PRD Section 8 data model.
Every tenant-scoped table must have tenant_id. Soft deletes where required.

Key tables to produce:
  tenants, users, verticals, clients, competitors, prompts,
  prompt_runs, brand_mentions, citation_sources, gap_reports,
  content_outputs, review_audits, community_threads, weekly_briefs,
  notifications, billing_events

Rules:
- tenant_id indexed on all query-heavy tenant-scoped tables
- JSON fields (aliases, models, prompt_templates, etc.) typed as Json in Prisma
- Enums: plan_tier, user_role, prompt_run_status, content_status, sentiment, notification_severity
- Soft delete: is_active boolean on tenants, clients, competitors, users

Skill: run schema-review after writing, before any migration.
Context7: use for Prisma schema syntax.
PDCA: present schema draft for approval before applying migration.
'@
    }

    # -- Phase 1 ---------------------------------------------------------------
    auth = @{
        model = $SONNET
        task  = "TASK-001"
        label = "Phase 1 . Auth & Identity"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, PostgreSQL 15, Redis 7, JWT RS256
Task file: tasks/TASK-001-auth.md
Module scope: src/auth/ ONLY.

Objective: Full JWT auth per PRD F-01.
  - Registration: email + password (bcrypt 12 rounds), email verification required
  - Login: access token 24hr + refresh token 30 days (httpOnly cookie)
  - Refresh rotation: each use issues new token, invalidates previous
  - Password reset: time-limited 1hr token via email
  - MFA: TOTP (Google Authenticator compatible), optional per tenant
  - Account lockout: 5 failed attempts ? 15 min lockout (Redis counter)
  - Rate limiting: 10 req/min per IP on auth endpoints
  - All auth events logged

JWT: RS256 asymmetric. Private key signs, public key verifies.
Keys from env: JWT_PRIVATE_KEY, JWT_PUBLIC_KEY (base64 encoded).
tenant_id extracted from JWT payload -- never from request body.

Exit criteria: auth E2E tests pass, tenant isolation penetration tested.
Context7: use for NestJS guards, Passport JWT strategy, @nestjs/jwt.
PDCA: present plan before touching any file.
'@
    }

    tenants = @{
        model = $SONNET
        task  = "TASK-002"
        label = "Phase 1 . Tenant & Client Management"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, PostgreSQL 15
Task file: tasks/TASK-002-tenants.md
Module scope: src/tenants/ ONLY.

Objective: Full tenant + client lifecycle per PRD F-02.
  Tenant: id, name, slug, plan_tier, billing_email, is_active,
    prompt_quota_daily, trial_ends_at, razorpay_subscription_id, billing_cycle_start
  Client: id, tenant_id, vertical_id, name, brand_name, aliases (JSON),
    city, state, website_url, description, models (JSON), is_active
  Client deletion: soft delete only, data retained 90 days

Tenant isolation: ALL queries MUST filter by tenant_id from JWT.
Use common/prisma/ TypeScript wrapper -- never raw Prisma without tenant scope.
Max 10 competitors per vertical per tenant on growth plan.

Context7: use for NestJS CRUD patterns, Prisma service injection.
PDCA: present plan before touching any file.
'@
    }

    users = @{
        model = $HAIKU
        task  = "TASK-001"
        label = "Phase 1 . User CRUD & RBAC (DONE 2026-04-27)"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma
Task file: tasks/TASK-001-phase1-auth-tenancy.md (DONE -- see Cycle 6 checkpoints)
Module scope: app/users/ ONLY. (DONE 2026-04-27 -- users, invite, role management, deactivate)

Objective: User CRUD + role-based access control per PRD F-01 / F-04.
  Roles: tenant_admin, client_manager, client_viewer, super_admin
  tenant_admin: full access to all clients, settings, billing, user management
  client_manager: manages specific clients, triggers content, approves content
  client_viewer: read-only dashboard access
  super_admin: cross-tenant, platform-level (Srinivas only)

Guards: RolesGuard + TenantGuard on every controller.
Invite flow: send email invite ? user sets password on first login.
All queries scoped by tenant_id from JWT.

Context7: use for NestJS RBAC guard patterns.
PDCA: present plan before touching any file.
'@
    }

    # -- Phase 2 ---------------------------------------------------------------
    verticals = @{
        model = $SONNET
        task  = "TASK-002"
        label = "Phase 2 . Vertical Config Engine"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, PostgreSQL 15
Task file: tasks/TASK-002-phase2-verticals-prompts.md
Module scope: app/verticals/ ONLY.
Branch: feature/phase2-verticals (create from feature/phase1-users if not yet created)
OPEN QUESTION #2: confirm Indian aggregator URLs per vertical with Srinivas before writing seed data.

Objective: Vertical configuration engine per PRD F-03.
Zero code deployment to add a new vertical -- everything is DB config.

Vertical entity fields to implement:
  prompt_templates, intent_categories, trusted_domains,
  aggregator_platforms (JSON with URL pattern + CSS selectors + crawl frequency),
  schema_types, community_platforms (subreddits + keywords),
  wikidata_entity_type, review_platforms

Seed all 5 verticals from PRD F-03:
  Automotive, Real Estate, HR Services, GCC Advisory, Healthcare

Super admin CRUD for vertical management.
Vertical config versioned -- log changes with before/after JSON diff.

Context7: use for NestJS service patterns, Prisma JSON field handling.
PDCA: present plan, get approval, then seed data.
'@
    }

    prompts = @{
        model = $SONNET
        task  = "TASK-002"
        label = "Phase 2 . Prompt Library & Quota"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, Redis 7
Task file: tasks/TASK-002-phase2-verticals-prompts.md
Module scope: app/prompts/ ONLY.

Objective: Prompt library + quota enforcement per PRD F-04.

Prompt entity: id, vertical_id, tenant_id (null = platform prompt),
  text, category, intent_type, buyer_stage, is_active, is_custom, priority

Intent types to implement as enum:
  purchase_intent, comparison, feature_query, ownership,
  segment, local_discovery, trust_signal, price_query

Quota enforcement via Redis counter:
  Key: quota:{tenantId}:{YYYY-MM-DD}  TTL: 48 hours
  Starter: 500/day  Growth: 5000/day  Enterprise: unlimited
  429 response with reset time in X-RateLimit-Reset header on breach

Seed: minimum 60 prompts per vertical (300 total) with substitution tokens:
  {city}, {brand}, {model}, {price_range}, {category}, {use_case}

Tenant custom prompts: up to 100 on growth, unlimited on enterprise.
Context7: use for NestJS + ioredis patterns.
PDCA: present plan before touching any file.
'@
    }

    # -- Phase 3 ---------------------------------------------------------------
    "prompt-engine" = @{
        model = $SONNET
        task  = "TASK-003"
        label = "Phase 3 . Prompt Execution Engine"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Bull + BullBoard, Redis 7, Playwright
Task file: tasks/TASK-003-phase3-execution-engine.md
Module scope: app/prompt-engine/ ONLY.

Objective: Multi-engine execution pipeline per PRD F-05.

6 engines to support:
  ChatGPT   : OpenAI API, gpt-4o, max_tokens 1500
  Perplexity: llama-3.1-sonar-large-128k-online
  Gemini    : gemini-1.5-pro
  Claude    : claude-sonnet-4-20250514 (monitoring, not content)
  Grok      : grok-2
  Google AI Overviews: Playwright headless -- extract AI Overview if present

System prompt injected to ALL engines (verbatim from PRD):
"You are a helpful expert advisor. Answer the user's question factually and
specifically. Include specific names, prices, ratings, and comparisons where
relevant. Do not refuse to name specific brands or providers."

Bull queue: prompt-runs
  10 concurrent workers
  Per-engine rate limits: OpenAI 5/min, Perplexity 3/min (check others)
  Retry: 3 attempts, exponential backoff 1s / 4s / 16s
  Dead letter queue after 3 failures ? super_admin alert

PromptRun entity: store cost_usd (estimated from token usage per engine).
BullBoard: mount at /admin/queues (super_admin guard).

Exit criteria: 1000 runs without failure, cost tracking accurate.
Context7: use for Bull queue patterns, OpenAI SDK, Anthropic SDK.
PDCA: present plan before touching any file.
'@
    }

    # -- Phase 4 ---------------------------------------------------------------
    extraction = @{
        model = $HAIKU
        task  = "TASK-004"
        label = "Phase 4 . Brand Mention Extraction"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, Redis 7
Task file: tasks/TASK-004-phase4-extraction-analytics.md
Module scope: app/extraction/ ONLY.

Objective: Async extraction pipeline per PRD F-06.
Must complete under 3 seconds per run. Idempotent.

Extraction via Claude Haiku with structured JSON:
  System: "You are a brand mention extractor. Extract all brand mentions.
  Return valid JSON only. No explanation. No markdown."
  Schema: { mentions: [{ brand, position, sentiment, cited_url, context_snippet }] }

BrandMention entity: map 1:1 to PRD F-06 fields.
Citation scoring (Redis cache):
  Windows: 7-day, 30-day, 90-day
  Dimensions: per engine, per intent_type, per city
  Key: citation:{clientId}:{window}:{engine}:{intent}  TTL: 1 hour
  Formula: (runs where client mentioned / total runs) x 100

Anomaly detection thresholds (per PRD F-06):
  Drop >10 points in 24h ? critical alert
  Competitor spike >15 points ? high alert

Exit criteria: accuracy validated on 200 sample responses.
Context7: use for Anthropic SDK structured output, ioredis.
PDCA: present plan before touching any file.
'@
    }

    analytics = @{
        model = $SONNET
        task  = "TASK-004"
        label = "Phase 4 . Analytics & Share of Voice"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, Redis 7
Task file: tasks/TASK-004-phase4-extraction-analytics.md
Module scope: app/analytics/ ONLY.

Objective: Citation scoring + share of voice + anomaly detection per PRD F-06/F-07.

APIs to expose for dashboard:
  GET /analytics/:clientId/citation-overview    (7-day gauge, 30-day per engine)
  GET /analytics/:clientId/share-of-voice       (vs top 5 competitors)
  GET /analytics/:clientId/sentiment            (donut + 30-day trend)
  GET /analytics/:clientId/prompts              (per-prompt citation rates)
  GET /analytics/:clientId/engines              (side-by-side engine comparison)
  GET /analytics/:clientId/sources              (cited URLs, schema types found)
  GET /analytics/:clientId/geo                  (by city)

All endpoints: Redis cache first (TTL 1hr), DB fallback.
Response target: under 200ms from cache.
All routes require tenant-scoped auth guard.

Context7: use for NestJS caching, ioredis patterns.
PDCA: present plan before touching any file.
'@
    }

    # -- Phase 6 ---------------------------------------------------------------
    diagnostics = @{
        model = $SONNET
        task  = "TASK-006"
        label = "Phase 6 . Gap Report & Diagnostics"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, Playwright, Cheerio
Task file: tasks/TASK-006-phase6-diagnostics.md
Module scope: app/diagnostics/ ONLY.

Objective: Competitor gap analysis pipeline per PRD F-08.

Pipeline steps (exact order):
  1. Collect CitationSource URLs from top 3 competitor BrandMentions
  2. Crawl with Playwright (handles JS-rendered pages)
  3. Extract: JSON-LD schema types, FAQ presence, word count,
     publication date, heading structure, named entity density
  4. Crawl client site: same extraction on top 10 pages
  5. Diff findings
  6. Generate plain English summary via Claude Sonnet (400-600 words)
  7. Store versioned GapReport

GapReport entity: map exactly to PRD F-08 fields.
  on_site_gaps, off_site_gaps stored as typed JSON.
  Gap closure tracking: delta vs previous_report_id.

Scheduling: every Monday + on citation drop >10 points + on-demand.
Exit criteria: reports generated for 10 test clients, findings validated.
Context7: use for Playwright page.evaluate, Cheerio parsing.
PDCA: present plan before touching any file.
'@
    }

    # -- Phase 7 ---------------------------------------------------------------
    "content-agent" = @{
        model = $SONNET
        task  = "TASK-007"
        label = "Phase 7 . Content Agent"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, Claude Sonnet
Task file: tasks/TASK-007-phase7-content-agent.md
Module scope: app/content-agent/ ONLY.

Objective: AEO content generation + approval workflow per PRD F-09.

4 content types: FAQ Page, Comparison Page, Entity Authority Page, Segment Article.

FAQ Page rules (enforced via system prompt + post-generation validation):
  - Answer in first sentence -- no preamble
  - Minimum one specific number per answer
  - Maximum 90 words per answer
  - No superlatives without data
  - Include competitor comparison where client has measurable advantage

Automated quality validation before saving draft:
  - JSON-LD parses without error
  - All answers 50-100 words
  - At least one specific number per answer
  - No blocked phrases (flag with suggestion)
  - HTML validates
  - Title under 70 chars

Approval workflow states: draft ? revision_requested ? approved ? published
  client_manager notified on draft creation.
  Revision: regenerate with review_notes injected into prompt.
  60-day follow-up: capture citation_rate_after.

ContentOutput entity: store generation_prompt for auditability.
Exit criteria: 50 pieces generated and reviewed by Srinivas.
Context7: use for Anthropic SDK, NestJS events for workflow state.
PDCA: present plan before touching any file.
'@
    }

    # -- Phase 8 ---------------------------------------------------------------
    offsite = @{
        model = $SONNET
        task  = "TASK-008"
        label = "Phase 8 . Off-Site Authority Builder"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, Playwright, Cheerio
Task file: tasks/TASK-008-phase8-offsite-builder.md
Module scope: app/offsite/ ONLY (all 5 sub-modules).

Objective: Off-site authority builder per PRD F-10.
5 modules -- implement one at a time, report before proceeding to next.

Module A -- Aggregator Profile Monitor:
  Crawl client profile on vertical aggregator platforms weekly.
  Extract completeness score, compare vs top 3 competitors.
  Alert on competitor profile hash change.

Module B -- Review Velocity Manager:
  Monitor Google Business Profile (Places API) + vertical platforms.
  Review request kit: WhatsApp + SMS + email templates + QR code HTML.
  Negative review alert: immediate + de-escalation draft.

Module C -- Community Presence Monitor:
  Reddit API (or Playwright fallback -- check open question #6 in PRD).
  Score threads by AI citation frequency.
  Generate authentic response draft: helpful first, no promotional language.

Module D -- Knowledge Graph Entity Manager:
  Wikidata API check for existing entity.
  Generate Wikidata item submission draft if missing.
  Google Knowledge Panel check via search simulation.

Module E -- PR Signal Generator:
  RSS monitoring from vertical trusted_domains list.
  PR angle + press release draft on news hook match.
  Wire services: PRNewswire India, BusinessWire India, PRLog India.

Exit criteria: all 5 modules tested on 3 Fidelitus internal brands.
Context7: use for Playwright, Cheerio, Reddit API, Google Places API.
PDCA: present plan for each sub-module before implementing.
'@
    }

    # -- Phase 9 ---------------------------------------------------------------
    "weekly-brief" = @{
        model = $HAIKU
        task  = "TASK-009"
        label = "Phase 9 . Weekly Brief"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, Redis 7, SendGrid, Claude Haiku
Task file: tasks/TASK-009-phase9-weekly-brief.md
Module scope: app/weekly-brief/ ONLY.

Objective: Monday 6AM IST weekly action digest per PRD F-11.

Rules (non-negotiable):
  Maximum 3 actions per brief regardless of backlog.
  Every action must have pre-generated draft ready -- no blank tasks.
  Client effort per action: under 30 minutes.

Generation pipeline (exact order per PRD):
  1. Compute citation score delta vs previous week
  2. Rank all pending actions by estimated citation impact
  3. Select top 3
  4. Generate brief via Claude Haiku
  5. Store WeeklyBrief
  6. Send email via SendGrid
  7. Push dashboard notification badge
  8. Auto-generate GapReport if citation score dropped
  9. Auto-generate content drafts for 3 worst-performing prompts

Action types: reddit_reply, content_approval, review_request, pr_approval, profile_update.
WeeklyBrief entity: map to PRD F-11 fields exactly.

Exit criteria: 4 consecutive Monday briefs correct for test clients.
Context7: use for NestJS scheduler (@Cron), SendGrid SDK.
PDCA: present plan before touching any file.
'@
    }

    # -- Phase 10 --------------------------------------------------------------
    billing = @{
        model = $SONNET
        task  = "TASK-010"
        label = "Phase 10 . Billing & Plan Management"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, Razorpay
Task file: tasks/TASK-010-phase10-billing.md
Module scope: app/billing/ ONLY.

Objective: Fully automated billing per PRD F-12. Zero manual invoicing.

Plans (INR, monthly recurring):
  Starter:    Rs 5,000   -- 1 client, 4 engines, 500 runs/day
  Growth:     Rs 15,000  -- 10 clients, all engines, 5000 runs/day
  Enterprise: Rs 45,000  -- unlimited clients, unlimited runs

Razorpay integration:
  Subscriptions: recurring monthly auto-debit
  Webhooks: payment.captured, subscription.halted, subscription.cancelled
  Invoice: auto-generated PDF, emailed on payment success

Failed payment: retry D+1, D+3, D+7 ? suspend tenant (not delete).
Trial: 14 days, full Growth features, no credit card.
Trial email sequence: D+7 reminder, D+12 warning, D+14 end.
Upgrade: immediate, prorated. Downgrade: next cycle.
Cancellation: self-serve, data retained 90 days.

Open question from PRD: does Razorpay support prorated upgrade billing natively?
Check and report before implementing.

Exit criteria: full billing cycle passes in Razorpay test mode.
Context7: use for Razorpay Node SDK, NestJS webhook handling.
PDCA: present plan before touching any file.
'@
    }

    # -- Phase 11 --------------------------------------------------------------
    notifications = @{
        model = $HAIKU
        task  = "TASK-011"
        label = "Phase 11 . Notifications"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, SendGrid, Redis 7
Task file: tasks/TASK-011-phase11-notifications.md
Module scope: app/notifications/ ONLY.

Objective: Notification and alert system per PRD F-13.

Severity tiers (per PRD):
  Critical (immediate email + in-app):
    Citation rate drop >10 points in 24h
    Competitor spike >15 points
    Negative review unanswered 24h
    Payment failed
    Prompt run failure rate >20% in 1hr window

  High (daily digest + in-app):
    Community thread with AI citation + client absent
    Content draft ready for review
    Gap report generated
    New competitor citation source domain

  Medium (weekly brief only):
    Aggregator score below 60
    Review backlog >20 customers
    PR opportunity detected

Rate limiting: same type per client max 1 per 4 hours (Redis).
Notification entity: map to PRD F-13 fields.

Context7: use for NestJS event emitter, SendGrid templates.
PDCA: present plan before touching any file.
'@
    }

    # -- Phase 12 --------------------------------------------------------------
    admin = @{
        model = $SONNET
        task  = "TASK-012"
        label = "Phase 12 . Super Admin Platform"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, Next.js 14 App Router
Task file: tasks/TASK-012-phase12-super-admin.md
Module scope: app/admin/ + frontend/app/admin/ ONLY.

Objective: Super admin operational dashboard per PRD F-14.
Access: super_admin role only. Not client-facing.

Backend capabilities:
  Cross-tenant dashboard: all tenants, plan, usage, MRR, health
  System health: queue depths, DLQ contents, Redis memory, DB pool, API key errors
  Cost monitor: per engine per day, per tenant, margin analysis
  Manual controls: trigger any run, regenerate any report, flush cache, force weekly brief
  Billing overrides: extend trial, apply discount, force plan change
  Read-only impersonation: view as any tenant_admin for support

Frontend:
  Server-side rendered (Next.js App Router)
  Real-time queue status from BullBoard API
  Cost trend charts (Recharts)

Super admin role enforced at guard level -- not configurable by tenants.
Context7: use for NestJS guards, Next.js server components.
PDCA: present plan before touching any file.
'@
    }

    # -- Phase 5 ---------------------------------------------------------------
    frontend = @{
        model = $SONNET
        task  = "TASK-005"
        label = "Phase 5 . Analytics Dashboard (Next.js)"
        prompt = @'
Stack: Next.js 14 App Router, TypeScript, shadcn/ui, Tailwind, Recharts
Task file: tasks/TASK-005-phase5-dashboard.md
Module scope: frontend/ ONLY.

Objective: Client analytics dashboard per PRD F-07.
API client: typed fetch wrapper generated from NestJS Swagger spec.
  Command: npx openapi-typescript http://localhost:3000/api-json -o frontend/lib/api.d.ts

Dashboard sections to implement:
  Citation Overview: 7-day gauge + 30-day line chart per engine + delta
  Share of Voice: stacked bar vs top 5 competitors (filter by intent, engine)
  Sentiment Analysis: donut chart + 30-day trend + context snippets
  Prompt-Level Analysis: table with citation rate, engine breakdown, trend
  Engine Breakdown: side-by-side citation rate comparison
  Citation Source Analysis: URLs + schema types found
  Geographic Segmentation: citation by city

Performance targets:
  Dashboard SSR initial load: under 2 seconds
  Chart data (from API cache): under 200ms
  Auto-refresh: every 5 minutes while open
  Responsive: tablet + mobile functional

Context7: use for Next.js App Router data fetching, shadcn/ui components, Recharts.
PDCA: present plan before touching any file.
'@
    }

    # alias
    dashboard = @{
        model = $SONNET
        task  = "TASK-005"
        label = "Phase 5 . Analytics Dashboard (Next.js)"
        prompt = @'
Stack: Next.js 14 App Router, TypeScript, shadcn/ui, Tailwind, Recharts
Task file: tasks/TASK-005-phase5-dashboard.md
Module scope: frontend/ ONLY.

Objective: Client analytics dashboard per PRD F-07.
API client: typed fetch wrapper generated from NestJS Swagger spec.
  Command: npx openapi-typescript http://localhost:3000/api-json -o frontend/lib/api.d.ts

Dashboard sections to implement:
  Citation Overview: 7-day gauge + 30-day line chart per engine + delta
  Share of Voice: stacked bar vs top 5 competitors (filter by intent, engine)
  Sentiment Analysis: donut chart + 30-day trend + context snippets
  Prompt-Level Analysis: table with citation rate, engine breakdown, trend
  Engine Breakdown: side-by-side citation rate comparison
  Citation Source Analysis: URLs + schema types found
  Geographic Segmentation: citation by city

Performance targets:
  Dashboard SSR initial load: under 2 seconds
  Chart data (from API cache): under 200ms
  Auto-refresh: every 5 minutes while open
  Responsive: tablet + mobile functional

Context7: use for Next.js App Router data fetching, shadcn/ui components, Recharts.
PDCA: present plan before touching any file.
'@
    }

    # -- Debug -----------------------------------------------------------------
    debug = @{
        model = $SONNET
        task  = "TASK-???"
        label = "Debug Session"
        prompt = @'
Stack: NestJS, TypeScript 5.x, Prisma, PostgreSQL 15, Redis 7, Bull
Task: one error, one file, one session.

Paste in order:
  1. Full stack trace / error message
  2. Only the function or method that threw it
  3. Relevant schema or entity if DB-related

Known project gotchas:
  - All DB queries must be tenant_id scoped (TenantScopedPrismaService)
  - Bull queue workers: check DLQ before assuming job was lost
  - Redis quota keys: quota:{tenantId}:{YYYY-MM-DD} -- check TTL (48h)
  - JWT: RS256 asymmetric -- private key base64 encoded in env
  - Playwright: always close browser in finally block

PDCA: diagnose first, present fix plan, wait for approval before editing.
'@
    }
}

# -- LIST MODE -----------------------------------------------------------------
if ($Session -eq "list") {
    Write-Host ""
    Write-Host "  AEO Suite -- Available Sessions" -ForegroundColor Cyan
    Write-Host ""
    Write-Host ("  {0,-22} {1,-44} {2}" -f "SESSION", "LABEL", "MODEL") -ForegroundColor DarkGray
    Write-Host ("  {0,-22} {1,-44} {2}" -f "-------------------", "------------------------------------------", "----------") -ForegroundColor DarkGray
    foreach ($key in $sessions.Keys | Sort-Object) {
        $s = $sessions[$key]
        $tag = if ($s.model -like "*haiku*") { "Haiku  [G]" } else { "Sonnet [B]" }
        Write-Host ("  {0,-22} {1,-44} [{2}]" -f $key, $s.label, $tag)
    }
    Write-Host ""
    exit 0
}

# -- LAUNCH SESSION ------------------------------------------------------------
$s = $sessions[$Session]

Write-Host ""
Write-Host "  +------------------------------------------------------+" -ForegroundColor Cyan
Write-Host ("  |  {0,-52}|" -f $s.label) -ForegroundColor Cyan
Write-Host ("  |  Task:  {0,-48}|" -f $s.task) -ForegroundColor Cyan
Write-Host ("  |  Model: {0,-48}|" -f $s.model) -ForegroundColor Cyan
Write-Host "  +------------------------------------------------------+" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Context:" -ForegroundColor DarkGray
Write-Host $s.prompt -ForegroundColor White
Write-Host ""

$s.prompt | Set-Clipboard
Write-Host "  v Context copied to clipboard." -ForegroundColor Green
Write-Host "  -> Paste into Claude Code, then type: superpowers brainstorm" -ForegroundColor Cyan
Write-Host ""

Set-Location $PROJECT_ROOT
$env:ANTHROPIC_MODEL = $s.model
claude --model $s.model