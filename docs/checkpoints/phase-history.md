# Phase History Archive
# Moved from CLAUDE.md on 2026-05-16 to keep active context clean.
# Reference only — do not edit.

## Phase 12 Complete ✅ (2026-05-16)

## TASK-012 Enhanced Client Onboarding (2026-05-16)
  4 new optional fields added to Client entity + frontend form extended

  Final commit     : 022a3229 (main)
  Completion date  : 2026-05-16

  New fields       : digital_handles (Json), brand_description (String), brand_keywords (Json), competitors_known (Json)
  Migration        : 20260516065553_add_client_brand_profile (additive, no breaking changes)
  API              : PATCH /clients/:id/profile — update profile fields after creation
  DTO              : UpdateClientProfileDto + CreateClientDto extended (tenants module)
  Frontend         : new-client form extended with "Brand Profile (Optional)" section
  Tests            : 9/9 passing (7 unit + 2 E2E)
  Build status     : 0 tsc errors, production build succeeds

  Key fixes during implementation:
    - POST endpoint was in /tenants/me/clients (not /clients)
    - TenantScopedPrismaService.createClient() type extended with new fields
    - Frontend field names corrected to snake_case

## Phase 10 Complete (2026-05-13, pending live Razorpay API keys from Sir)
  Final commit: e3114ba3 — trial auto-start wired to AuthService.register (Phase 10 exit criterion met)

  Billing Module — all 17 tasks done + trial auto-start on registration, 166/166 jest passing, 0 tsc errors:

  Services shipped  : PlanEnforcementService, SubscriptionService, TrialService,
                      InvoiceService, WebhookService, BillingService (orchestrator)
  Guard             : BillingGuard (global, 402 on suspended tenants)
  Processors        : trial.processor, payment-retry.processor, tenant-purge.processor
  Controller        : 6 endpoints (subscribe, cancel, plan, trial/start, status, webhook/razorpay)
  E2E tests         : app/billing/__tests__/billing.e2e.spec.ts — 3 scenarios, 7 assertions
  Webhook           : timing-safe HMAC, payment.captured / subscription.halted / subscription.cancelled
  Invoice           : pdfkit PDF emailed on payment success
  Trial             : 14-day Growth, D+7/D+12/D+14 email sequence, ends → Starter
  Failed payment    : retry D+1/D+3/D+7, suspend tenant on D+7 no recovery
  Cancellation      : self-serve, billing_suspended=true, 90-day purge job scheduled

  Remaining blocker : Razorpay live API keys from Sir (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
                      RAZORPAY_WEBHOOK_SECRET) to flip RAZORPAY_STUB=false and run full cycle

## Competitor Extraction Pipeline (2026-05-14)
  TASK-004 follow-up: Full CRUD, seeding, hierarchical matching for competitor resolution

  Commit           : 87facba1 (main)
  CompetitorsService    : Full CRUD (create, list, update, soft-delete) + idempotent seeding
  CompetitorsController : REST endpoints with tenant scoping & role-based access (POST/GET/PATCH/DELETE)
  Seed data             : 50 baseline competitors, 10 per vertical (automotive, real_estate, hr_services, gcc_advisory, healthcare)
  ExtractionResolver    : Hierarchical matching (exact → substring → partial alias) for robust brand resolution
  Test results          : 204/204 passing (all suites, no regressions)

## Prompt Library (2026-05-13)
  Platform prompts trimmed to 10 per vertical (was 64) as per Sir's instruction.
  Commit : fe528bf0
  Totals : 50 platform prompts (5 verticals × 10), 270 deleted

## Phase 9 Complete (2026-05-12, main HEAD: 4e768b4f)
  Weekly Brief Pipeline Step 9 — Content Draft Auto-Generation:
  Step 9 Auto-Gen  : DownstreamTrigger.triggerContentDraftsForWorstPrompts()
  Test status      : 103/103 passing
  CI fixes         : tsconfig.json + lint errors resolved

## Phase 8 Complete (2026-05-05, merged to main 2026-05-11/12)
  All 5 Offsite modules shipped under app/offsite/:
  Module A — Aggregator Profile Monitor   (app/offsite/aggregator/)
  Module B — Review Velocity Manager      (app/offsite/reviews/)
  Module C — Community Presence Monitor   (app/offsite/community/)
  Module D — Knowledge Graph Entity Mgr   (app/offsite/knowledge-graph/)
  Module E — PR Signal Generator          (app/offsite/pr/)

  Post-Phase-8 cleanup:
    Mail service    : nodemailer SMTP, sendVerificationEmail wired to auth
    Run Prompts UI  : POST /prompt-engine/clients/:clientId/run-all
    Cerebras        : AiEngine.cerebras added to DEFAULT_ENGINES + SCHEDULED_ENGINES
    TASK-007 validators: answer_indirect_opening, bare_superlative, howto_schema_missing, etc.
    State machine   : rejectOutput added (draft→rejected)

## Phase 7 Handoff (2026-05-04, main HEAD: ebb71cd8)
  Content generators originally used: Cerebras llama3.1-8b (REPLACED in fix-models session)
  Content UI (F-07) : /dashboard/[clientId]/content — tabs, table, iframe preview
  19 content outputs in DB for stress client cmonwtk9r00002ku9q59ge1h4

## Phases 0–6 Complete (2026-05-12)
  All phases from initial setup through Phase 6 merged to main.
  HEAD at completion: 4e768b4f
