# PRD -- AEO Suite
**Version:** 2.1
**Date:** April 2026
**Owner:** Srinivas / Fidelitus Corp / SherpaVector
**Status:** Final -- Approved for Development
**Build model:** Solo developer + claude code
**Launch model:** Full feature build -> hardened -> 5 design partners -> commercial

---

## 1. Overview

AEO Suite is a production-grade, multi-tenant SaaS platform that gives Indian brands
and their agencies complete visibility and control over how AI engines represent them.
The platform monitors brand citations across ChatGPT, Perplexity, Gemini, Claude,
Grok, and Google AI Overviews -- then diagnoses gaps, generates AEO-optimized content
to close those gaps, and builds off-site authority signals that AI engines trust.

AEO Suite is vertical-agnostic by architecture. Verticals are configuration, not code.
The same platform serves automotive, real estate, HR services, GCC advisory,
healthcare, and any other Indian industry segment without code changes per vertical.

This is not a prototype. Every feature described in this document ships before any
client is onboarded. There are no deferred features, no post-MVP items, and no known
technical debt accepted at launch.

---

## 2. Problem Statement

Over 100 million people search using AI engines daily. When a user asks ChatGPT
"best HR staffing firm in Bangalore" or "top real estate developer Pune under 1 crore"
-- traditional Google rank is irrelevant. What determines the answer is whether the
AI engine has enough structured, trusted, authoritative signal about that brand to
cite it confidently.

Indian brands are invisible in this new search layer. The reasons are specific:

- Their websites have no machine-readable schema AI crawlers can extract
- Their content answers human readers, not AI extraction patterns
- They have weak entity presence in knowledge graphs (Wikidata, Google KG)
- They are absent from or poorly structured on the aggregator platforms
  (CarDekho, 99acres, Naukri, Practo) that AI engines cite as authoritative
- No tool exists today that monitors, diagnoses, and fixes this for Indian markets

Existing platforms (Profound at $399/month USD, Peec AI in Europe) are inaccessible
to Indian SMBs, ignore Indian aggregators, Indian languages, and Indian search
behavior. They also stop at monitoring -- they show you the gap but do not close it.

AEO Suite is the first full-stack AEO platform built for India -- monitor, diagnose,
and execute, all in one platform, at Indian pricing.

---

## 3. Goals and Success Metrics

| Goal | Metric | Target at Commercial Launch |
|------|--------|-----------------------------|
| Platform stability | Uptime | 99.9% measured over beta period |
| Citation tracking | Engines covered | 6 (ChatGPT, Perplexity, Gemini, Claude, Grok, Google AI Overviews) |
| Content quality | FAQ pages achieving citation within 60 days | Greater than 40% |
| Design partner satisfaction | NPS from 5 beta clients | Greater than 50 |
| Citation improvement | Average citation rate delta for beta clients | +25 percentage points in 90 days |
| Revenue readiness | Billing, invoicing, plan enforcement working | 100% automated |
| Security | Penetration test findings critical/high | Zero |
| Test coverage | E2E test pass rate | 100% |
| Performance | API p95 response time | Less than 400ms |

---

## 4. Users

### Tenant Types
Marketing Agencies -- multi-client workspaces managing AEO for their brand clients.
Primary buyer. Needs white-label readiness, multi-client dashboard, agency reporting.

Brand In-House Teams -- single-tenant, multiple users from same company.
Needs client viewer roles, weekly brief, content approval workflows.

AEO Consultants -- solo practitioners managing multiple client brands.
Needs lightweight onboarding, exportable reports, low operational overhead.

### Roles Within Each Tenant
tenant_admin -- full access to all clients, settings, billing, user management.
client_manager -- manages specific clients, triggers content generation, approves content.
client_viewer -- read-only dashboard access for client stakeholders.

### Platform Roles
super_admin -- Srinivas / SherpaVector team. Full platform access.
Cross-tenant visibility, vertical config, system health, billing overrides.

---

## 5. Complete Feature Specification

---

### F-01: Authentication and Identity

Full JWT-based authentication with RS256 signing (asymmetric keys), refresh token
rotation, TOTP-based MFA, and account lockout. Every database query is scoped by
tenant_id extracted from the JWT -- enforced at the service layer via TypeScript
wrapper types, not application logic.

Registration: email + password (bcrypt 12 rounds), email verification required.
Login: access token (24hr) + refresh token (30 days, httpOnly cookie).
Refresh rotation: each use issues new token, invalidates previous.
Password reset: time-limited token via email, expires 1 hour.
MFA: TOTP (Google Authenticator compatible), optional per tenant, enforceable by super_admin.
Account lockout: 5 failed attempts triggers 15-minute lockout.
Rate limiting: 10 requests per minute per IP on auth endpoints.
All auth events logged: login, logout, failure, reset, MFA events.

---

### F-02: Tenant and Client Management

Full lifecycle management for tenants and their brand clients. Every configuration
decision -- vertical, competitors, prompts, review platforms -- managed here.

Tenant entity: id, name, slug (unique URL-safe), plan_tier, billing_email, is_active,
prompt_quota_daily, trial_ends_at, razorpay_subscription_id, billing_cycle_start.

Client entity: id, tenant_id, vertical_id, name, brand_name, aliases (JSON array),
city, state, website_url, description, models (JSON), is_active.
Client aliases used in extraction (e.g. "Tata Nexon" and "Nexon" map to same client).
Client deletion: soft delete only, data retained 90 days then purged.

Competitor entity: id, tenant_id, vertical_id, name, aliases (JSON array), website_url.
Competitors are tenant-level, shared across clients in same vertical.
Maximum 10 active competitors per vertical per tenant (growth plan), unlimited enterprise.

---

### F-03: Vertical Configuration Engine

Verticals are database configuration, not code. Adding a new vertical requires
zero code deployment. Every platform behaviour -- prompts, schema types, aggregators,
community platforms, review platforms -- is determined by vertical config at runtime.

Vertical entity fields:
- prompt_templates: array of template strings with substitution tokens
  {city}, {brand}, {model}, {price_range}, {category}, {use_case}
- intent_categories: valid intent types for this vertical
- trusted_domains: domains AI engines trust for this vertical
- aggregator_platforms: JSON config per platform including URL pattern,
  CSS selectors for rating and review count, crawl frequency
- schema_types: schema.org types to generate for this vertical
- community_platforms: subreddits and forums to monitor with keywords
- wikidata_entity_type: schema.org type for Wikidata entity creation
- review_platforms: Google + vertical-specific platforms with API/scrape config

Seeded verticals at launch (fully configured):

Automotive:
  Trusted domains: cardekho.com, autocarindia.com, zigwheels.com,
    carandbike.com, indianautos.com, team-bhp.com
  Aggregators: CarDekho dealer profiles, ZigWheels dealer profiles
  Schema types: Vehicle, AutoDealer, FAQPage, Review
  Communities: r/CarTalkIndia, r/IndiaCar, r/bangalore, r/mumbai, r/pune
  Review platforms: Google, CarDekho, JustDial

Real Estate:
  Trusted domains: 99acres.com, magicbricks.com, housing.com,
    squareyards.com, proptiger.com
  Aggregators: 99acres developer profiles, MagicBricks listings
  Schema types: RealEstateAgent, Residence, FAQPage, Review
  Communities: r/bangalore, r/mumbai, r/pune, r/DelhiNCR
  Review platforms: Google, 99acres, JustDial, MouthShut

HR Services:
  Trusted domains: naukri.com, linkedin.com, glassdoor.co.in,
    ambitionbox.com, teamlease.com
  Aggregators: Naukri recruiter profiles, LinkedIn company pages
  Schema types: EmploymentAgency, FAQPage, Review
  Communities: r/india, r/developersIndia, r/cscareerquestionsIndia
  Review platforms: Google, Glassdoor, Ambitionbox, JustDial

GCC Advisory:
  Trusted domains: nasscom.in, economictimes.com, business-standard.com,
    livemint.com, techcircle.in
  Aggregators: NASSCOM member directory, LinkedIn company pages
  Schema types: ProfessionalService, FAQPage, Organization
  Communities: r/india, r/IndiaTech
  Review platforms: Google, LinkedIn, Clutch.co, G2

Healthcare:
  Trusted domains: practo.com, 1mg.com, apollohospitals.com, fortishealthcare.com
  Aggregators: Practo clinic and hospital profiles
  Schema types: MedicalOrganization, Hospital, Physician, FAQPage
  Communities: r/india, r/bangalore, r/mumbai
  Review platforms: Google, Practo, JustDial

Vertical management:
- Super admin UI for vertical CRUD
- Vertical config versioned -- changes logged with before/after JSON diff
- New vertical can be cloned from existing and modified
- Deactivation does not affect existing clients (they retain their config snapshot)

---

### F-04: Prompt Library and Management

The prompt library is the intelligence core. It defines every question fired at
AI engines on behalf of clients. Platform prompts maintained by super_admin.
Tenant custom prompts managed by tenant_admin.

Prompt entity: id, vertical_id, tenant_id (null for platform prompts), text,
category, intent_type, buyer_stage, is_active, is_custom, priority.

Intent types (universal across verticals):
- purchase_intent: "best {category} under {price} in {city}"
- comparison: "{brand_a} vs {brand_b} which is better"
- feature_query: "which {category} has best {feature}"
- ownership: "long term reliability of {brand}"
- segment: "best {category} for {use_case}"
- local_discovery: "top {category} provider in {city}"
- trust_signal: "is {brand} trustworthy"
- price_query: "{brand} pricing in India 2025"

Buyer stages: awareness, consideration, decision, retention.

Prompt quota enforced daily per tenant via Redis counter:
  Starter: 500 prompt runs/day
  Growth: 5,000 prompt runs/day
  Enterprise: unlimited (fair use policy)
  Key: quota:{tenantId}:{YYYY-MM-DD}, TTL 48 hours
  Breach: 429 response with reset time in header

Seeded prompt library: minimum 60 prompts per vertical at launch.
Tenant custom prompts: up to 100 on growth plan, unlimited on enterprise.

---

### F-05: Prompt Execution Engine

The execution engine fires prompts across 6 AI engines on schedule and on demand.
It is the highest-volume component. It must be reliable, observable, cost-controlled,
and independently scalable from the API.

Supported engines:
  ChatGPT: OpenAI API, model gpt-4o, max_tokens 1500
  Perplexity: Perplexity API, model llama-3.1-sonar-large-128k-online
  Gemini: Google Generative AI SDK, model gemini-1.5-pro
  Claude: Anthropic SDK, model claude-sonnet-4-20250514
  Grok: xAI API, model grok-2
  Google AI Overviews: Playwright headless browser, extract AI Overview if present

System prompt injected to all engines:
"You are a helpful expert advisor. Answer the user's question factually and
specifically. Include specific names, prices, ratings, and comparisons where
relevant. Do not refuse to name specific brands or providers."

Execution pipeline:
1. Scheduler triggers at 2AM IST daily per tenant schedule
2. Each (prompt, client, engine) triple = one PromptRun job
3. Jobs pushed to Bull queue: prompt-runs
4. Worker pool: 10 concurrent workers
5. Per-engine rate limits enforced (OpenAI 5/min, Perplexity 3/min, etc.)
6. Retry policy: 3 attempts, exponential backoff (1s, 4s, 16s)
7. Dead letter queue after 3 failures, super_admin alert triggered
8. On-demand execution available to tenant_admin (counts against quota)

PromptRun entity: id, prompt_id, client_id, engine, raw_response, ran_at,
tokens_used, duration_ms, status, retry_count, error_message, cost_usd.

Cost tracking:
  Every run records estimated cost_usd from token usage.
  Tenant daily cost aggregated in Redis, stored monthly in DB.
  Super_admin cost monitor: per tenant, per engine, trend chart.
  Alert when tenant daily cost exceeds configurable threshold.

---

### F-06: Brand Mention Extraction Pipeline

Async pipeline that processes every PromptRun and produces structured brand signals.
Must be fast (under 3 seconds), accurate (alias-aware), and idempotent.

Extraction via Claude Haiku with structured JSON output:
System: "You are a brand mention extractor. Extract all brand mentions.
Return valid JSON only. No explanation. No markdown."
Schema: { mentions: [{ brand, position, sentiment, cited_url, context_snippet }] }

BrandMention entity: id, run_id, client_id, competitor_id (nullable), brand_name,
position (1-based), sentiment (enum), cited_url, context_snippet (150 chars),
is_client_brand (boolean).

Citation scoring computed for:
  Windows: 7-day, 30-day, 90-day rolling
  Dimensions: per engine, per intent_type, per city
  Formula: (runs where client mentioned / total runs) x 100
  Cached in Redis: citation:{clientId}:{window}:{engine}:{intent}
  TTL: 1 hour, recalculated on cache miss

Share of voice: client citation rate vs each competitor as percentage of total.

Anomaly detection:
  Citation rate drops more than 10 points in 24 hours: critical alert
  Competitor citation rate spikes more than 15 points: high alert
  Stored in Notification entity, email + dashboard badge

---

### F-07: Analytics Dashboard

Client-facing dashboard. Fast, accurate, immediately actionable.
All data backed by real extraction -- no placeholder states after first run.

Sections:
  Citation Overview: current 7-day rate gauge, 30-day line chart per engine, delta
  Share of Voice: stacked bar vs top 5 competitors, filterable by intent and engine
  Sentiment Analysis: donut chart, 30-day trend, context snippets
  Prompt-Level Analysis: table of all prompts with citation rate, engine breakdown, trend
  Engine Breakdown: citation rate per engine side-by-side comparison
  Citation Source Analysis: URLs AI engines cite for competitors, schema types found
  Geographic Segmentation: citation rate by city for multi-city clients

Performance:
  Dashboard initial load (SSR): under 2 seconds
  Chart data from Redis cache: under 200ms
  Auto-refresh: every 5 minutes while open
  Responsive: functional on tablet and mobile

---

### F-08: Diagnostic Engine and Gap Reports

Answers: "Why does my competitor get cited and I do not?"
Crawls competitor-cited URLs, analyses structure, diffs against client site,
produces structured gap report with specific actionable findings.

Gap report pipeline:
1. Collect all CitationSource URLs from top 3 competitor BrandMentions
2. Crawl with Playwright (handles JS-rendered pages)
3. Extract: JSON-LD schema types, FAQ schema presence, word count,
   publication date, heading structure, named entity density
4. Crawl client site: same extraction on top 10 pages
5. Diff findings: what cited pages have that client pages lack
6. Generate plain English summary via Claude Sonnet (400-600 words)
7. Store versioned GapReport

GapReport entity: id, client_id, version, generated_at,
  on_site_gaps (JSON: missing schema types, FAQ coverage score, freshness gap,
    entity density gap, internal link structure gap),
  off_site_gaps (JSON: aggregator presence, review volume gap, community presence,
    entity recognition gaps, PR coverage gap),
  top_cited_competitor_id, top_cited_domain, plain_english_summary,
  recommended_actions (JSON array ordered by citation impact), previous_report_id.

Scheduling:
  Auto-generated: every Monday alongside WeeklyBrief
  Auto-triggered: when citation rate drops more than 10 points
  On-demand: tenant_admin can trigger any time
  Gap closure tracking: each report delta vs previous version shown

---

### F-09: Content Agent -- On-Site Content Generation

Generates production-ready HTML pages with embedded JSON-LD schema, structured
specifically for AI citation. Human approval required before publish status.
Platform never auto-publishes to any CMS without explicit approval.

Content types:

FAQ Page:
  6-8 Q&A pairs targeting a specific prompt or prompt cluster.
  FAQPage JSON-LD + secondary vertical schema (Vehicle, Product, Organization, etc.).
  Answer rules (enforced via system prompt, validated post-generation):
    Answer in first sentence -- no preamble.
    Minimum one specific number per answer (price, rating, measurement, date).
    Maximum 90 words per answer.
    No superlatives without data (no "best", "leading" without citation).
    Include competitor comparison where client has measurable advantage.
    Geographic specificity where query is location-intent.

Comparison Page:
  Structured head-to-head: client vs one competitor.
  Machine-readable spec table with schema markup (not an image).
  Section per comparison dimension with honest verdict.
  FAQPage schema for common comparison questions.
  Internal links to relevant FAQ pages on client site.

Entity Authority Page:
  Structured for AI entity recognition.
  Organization/LocalBusiness/AutoDealer/EmploymentAgency schema per vertical.
  Factual sections: founding year, certifications, service area, offerings.
  Links to verifiable external mentions.
  Wikidata-compatible structured facts block.

Segment Article:
  1200-1800 words. Category authority article.
  Targets segment-level prompts ("best HR staffing firms India").
  Mentions client naturally within broader category analysis.
  HowTo or Article schema.
  Designed for category-level AI citations, not just brand queries.

Content generation pipeline:
1. Load: client details, vertical config, gap report, competitor data, prompt
2. Enrich: scrape client website for existing factual claims
3. Generate: Claude Sonnet with full context and AEO-specific system prompt
4. Validate: schema JSON validity, answer length rules, marketing language check
5. Store: ContentOutput with status draft
6. Notify: client_manager for review

ContentOutput entity: id, client_id, target_prompt_id, type, title,
html_content, schema_json, generation_prompt (stored for auditability),
status (draft/revision_requested/approved/published/rejected),
review_notes, approved_by, approved_at, published_at,
citation_rate_before, citation_rate_after (captured 60 days post-publish).

Approval workflow:
  Draft: client_manager notified via email + dashboard
  Review: HTML preview rendered in dashboard
  Options: Approve / Request Revision (with notes) / Reject
  Revision: regenerated with review notes injected into prompt
  Approved: download HTML enabled
  Published: client uploads to CMS, marks published in platform
  60-day follow-up: platform captures citation_rate_after for ROI proof

Automated quality validation (before draft saved):
  JSON-LD parses without error
  All answers between 50-100 words
  At least one specific number per answer
  No blocked phrases: flagged with replacement suggestion
  HTML validates (no broken tags)
  Title under 70 characters

---

### F-10: Off-Site Authority Builder

On-site content alone is insufficient. AI engines trust the web graph -- third-party
mentions, review volume, community presence, news coverage, knowledge graph entries.
Five modules monitor all signals, identify gaps, and provide ready-to-use outputs.
The platform does the work. The client provides authenticity.

Module A -- Aggregator Profile Monitor:
  Crawl client profile on each vertical aggregator platform weekly.
  Extract: completeness score (0-100), photo count, description length,
    certification badges, response rate, last updated.
  Compare against top 3 competitors on same platform.
  Generate profile update pack: optimised copy for every incomplete field,
    photo upload checklist, schema-friendly language.
  Alert when competitor updates profile (content hash change detected).

Module B -- Review Velocity Manager:
  Monitor review counts and ratings across all configured review platforms.
  Platforms: Google Business Profile (Places API) + vertical-specific platforms.
  Track: rating, review_count, recency, owner response rate, keyword frequency.
  Review request kit: WhatsApp template, SMS template, email template, QR code HTML.
  Review response drafts: for every unanswered review, draft generated for client.
  Negative review alert: immediate notification + de-escalation response draft.

Module C -- Community Presence Monitor:
  Monitor subreddits and forums for prompt-equivalent questions.
  Detection: question asked + competitor recommended + client not mentioned.
  Thread scored by AI citation frequency (how often Perplexity/ChatGPT cites this URL).
  High-value threads (cited 5+ times): urgent alert.
  Generate authentic response draft: helpful first, no promotional language,
    specific factual claims, geographic precision, fair competitor acknowledgement.
  Track response status: pending / posted / skipped.

Module D -- Knowledge Graph Entity Manager:
  Check Wikidata for existing entity matching client name and location.
  If missing: generate Wikidata item submission draft with all required fields.
  Check Google Knowledge Panel via search simulation.
  Wikipedia notability assessment: flag if threshold potentially met.
  Entity check runs monthly, alerts on status changes.

Module E -- PR Signal Generator:
  Monitor vertical news hooks via RSS from trusted domain list.
  When relevant news detected: generate PR angle + press release draft.
  Press release: inverted pyramid, factual, client principal quote placeholder.
  Distribution checklist per vertical with specific journalist/outlet contacts.
  Wire services: PRNewswire India, BusinessWire India, PRLog India.
  PR pickup tracker: monitor if release gets indexed by AI-trusted domains.

---

### F-11: Weekly Brief

Every Monday 6AM IST: one-page action digest per client. Maximum three actions.
Everything else the platform handled is logged and shown.
Scannable in 90 seconds. Every action has a pre-generated draft.

Generation pipeline:
1. Compute citation score delta vs previous week
2. Rank all pending actions by estimated citation impact
3. Select top 3 only (additional actions queued for future weeks)
4. Generate brief text via Claude Haiku
5. Store WeeklyBrief, send email via SendGrid, push dashboard notification
6. Auto-generate GapReport if citation score dropped
7. Auto-generate content drafts for bottom 3 performing prompts

Action types: reddit_reply, content_approval, review_request, pr_approval, profile_update.
Each action: type, priority, estimated_impact (plain English), draft_id, deep_link, time_estimate.

Brief rules:
  Maximum 3 actions regardless of backlog.
  Every action must have pre-generated draft ready (no blank tasks).
  Client effort per action: under 30 minutes.
  Platform-handled section: makes automated value visible to client.

WeeklyBrief entity: id, client_id, week_of, citation_score, citation_delta,
action_items (JSON max 3), platform_actions_log (JSON), email_sent_at,
actions_completed, generated_at.

---

### F-12: Billing and Plan Management

Fully automated. No manual invoicing. Plan enforcement real-time.
No human intervention required from day one.

Plans:
  Starter (Rs 5,000/month):
    1 client, 1 vertical, 500 prompt runs/day
    4 engines, 10 content generations/month, weekly brief, email support

  Growth (Rs 15,000/month):
    Up to 10 clients, all verticals, 5,000 prompt runs/day
    All 6 engines, unlimited content, full off-site builder, priority support

  Enterprise (Rs 45,000/month):
    Unlimited clients, unlimited runs (fair use), all engines
    White-label ready (custom domain + logo), API access
    Custom vertical config, dedicated Slack support, monthly strategy call

Billing implementation:
  Payment gateway: Razorpay (cards, UPI, net banking, international)
  Subscriptions: recurring monthly, auto-debit on billing date
  Invoices: auto-generated PDF, emailed on payment success
  Failed payment: retry D+1, D+3, D+7 then suspend tenant (not delete)
  Trial: 14 days, full Growth features, no credit card required
  Trial email sequence: D+7 reminder, D+12 expiry warning, D+14 end
  Upgrade: immediate, prorated billing for remainder of month
  Downgrade: takes effect next billing cycle
  Cancellation: self-serve, data retained 90 days then purged
  All billing events logged in billing_events entity

---

### F-13: Notification and Alert System

In-app and email notifications. Priority-tiered. Rate-limited to prevent spam.

Critical (immediate email + in-app):
  Citation rate drop more than 10 points in 24 hours
  Competitor citation spike more than 15 points
  Negative review with no response after 24 hours
  Payment failed
  Prompt run failure rate exceeds 20% in any 1-hour window

High (daily digest email + in-app):
  New community thread cited by AI with client absent
  Content draft ready for review
  Gap report generated
  New competitor citation source domain detected

Medium (weekly brief only):
  Aggregator profile score below 60
  Review request backlog exceeding 20 customers
  PR opportunity detected

Notification entity: id, tenant_id, client_id, type, severity, title, body,
deep_link, is_read, email_sent, created_at.
Rate limiting: same type per client maximum 1 per 4 hours.

---

### F-14: Super Admin Platform

Full operational visibility and control for platform operator (Srinivas / SherpaVector).
Not client-facing -- operational backbone for commercial operation.

Capabilities:
  Cross-tenant dashboard: all tenants, plan, usage, MRR, health status
  Tenant detail: client count, runs today, cost today, last active
  Vertical management: full CRUD for all verticals and configuration
  Prompt library management: add, edit, deactivate platform prompts
  System health: queue depths, failed jobs, DLQ contents, Redis memory,
    DB connection pool status, API key error rates per engine
  Cost monitor: total cost per engine per day, per tenant, margin analysis
  Manual controls: trigger any run, regenerate any report, flush any cache,
    force send weekly brief
  Billing overrides: extend trial, apply discount, force plan change
  Read-only impersonation: view platform as any tenant_admin for support

---

## 6. Non-Functional Requirements

### Performance
| Metric | Target |
|--------|--------|
| API read endpoints p95 | Under 400ms |
| API write endpoints p95 | Under 800ms |
| Dashboard initial load (SSR) | Under 2 seconds |
| Chart data (from Redis) | Under 200ms |
| Content generation end-to-end | Under 45 seconds |
| Prompt run queue lag | Under 5 minutes at growth tier |
| Extraction pipeline | Under 3 seconds per run |
| Email delivery | Under 2 minutes from trigger |

### Reliability
| Metric | Target |
|--------|--------|
| Platform uptime | 99.9% monthly |
| Prompt run success rate | Greater than 98% |
| Data loss tolerance | Zero |
| Queue durability | Bull with Redis persistence |
| Database backups | Daily automated, 30-day retention |

### Security
- TLS 1.3 minimum for all data in transit
- AES-256 encryption at rest (Supabase managed)
- JWT signed RS256 (asymmetric keys -- private key never leaves server)
- API keys stored encrypted in DB (AES-256 application-level)
- All user inputs sanitised: HTML stripped, Prisma prevents SQL injection
- Tenant isolation enforced at service layer via TypeScript wrapper types
- Security headers: Helmet (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- CORS: whitelist via env config
- Rate limiting: 100 req/min per IP global, 10/min on auth endpoints
- Request size limit: 1MB
- Dependency audit: npm audit in CI pipeline, critical findings block deploy
- Penetration test (OWASP Top 10 minimum) before commercial launch

### Observability
- Structured JSON logging via Winston: every request logged with
  tenant_id, client_id, user_id, duration_ms, status_code
- Error tracking: Sentry with tenant_id and client_id context
- Health endpoint: /health returns DB status, Redis status, queue depth, uptime
- Queue admin: BullBoard dashboard (super_admin access only)
- Cost metrics: daily aggregation per tenant per engine stored in DB

### Scalability
- Stateless API: horizontally scalable, no server-side session
- Queue workers: independently scalable from API
- Redis: all shared state (no in-memory server state)
- Architecture supports moving to separate worker instances without code changes

---

## 7. Technical Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Backend framework | NestJS | Latest | Enterprise-grade, decorator-based, wide ecosystem |
| Language | TypeScript | 5.x | Type safety enforced end to end |
| ORM | Prisma | Latest | Type-safe queries, excellent migrations, Gemini CLI friendly |
| Database | PostgreSQL | 15 | Relational, multi-tenant, RLS-capable |
| Cache and Queue | Redis | 7 | Session cache, Bull queue, quota counters |
| Queue system | Bull + BullBoard | Latest | Reliable job queue with admin UI |
| AI Extraction | Claude Haiku | claude-haiku-4-5-20251001 | Fast, cheap, structured JSON |
| AI Content | Claude Sonnet | claude-sonnet-4-20250514 | Quality content generation |
| Engine 1 | OpenAI | gpt-4o | ChatGPT monitoring |
| Engine 2 | Perplexity | sonar-large-128k-online | Real-time retrieval monitoring |
| Engine 3 | Google Gemini | gemini-1.5-pro | Gemini monitoring |
| Engine 4 | Anthropic | claude-sonnet-4-20250514 | Claude monitoring |
| Engine 5 | xAI Grok | grok-2 | Grok monitoring |
| Engine 6 | Playwright headless | Latest | Google AI Overviews (no API) |
| Web crawling | Playwright + Cheerio | Latest | JS-rendered page support |
| Schema extraction | extruct Python microservice | Latest | JSON-LD, microdata, RDFa |
| Frontend | Next.js | 14 App Router | SSR, typed fetch client from OpenAPI spec |
| UI components | shadcn/ui + Tailwind | Latest | Accessible, consistent, fast to build |
| Charts | Recharts | Latest | Citation trend, share of voice |
| Email | SendGrid | Latest | Transactional + weekly brief |
| Payments | Razorpay | Latest | Indian methods, subscriptions, INR |
| Authentication | JWT RS256 + bcrypt | -- | Stateless, asymmetric, secure |
| Containerisation | Docker + docker-compose | Latest | Dev/prod parity |
| CI/CD | GitHub Actions | -- | Lint + test + build + deploy |
| Hosting API | Render | -- | Auto-deploy, managed |
| Hosting DB | Supabase PostgreSQL | -- | Managed, daily backup, Indian-reachable |
| Hosting Redis | Upstash | -- | Managed Redis with persistence |
| Error tracking | Sentry | -- | Structured errors with context |
| Logging | Winston | -- | Structured JSON logs |
| Production build | Gemini CLI | Latest | Srinivas established workflow |

---

## 8. Data Model

tenants: id, name, slug, plan_tier, billing_email, is_active,
  prompt_quota_daily, trial_ends_at, razorpay_subscription_id, billing_cycle_start

users: id, tenant_id, email, password_hash, role, is_active,
  mfa_secret (encrypted), mfa_enabled, last_login_at

verticals: id, name, slug, description, prompt_templates, trusted_domains,
  aggregator_platforms, schema_types, community_platforms,
  wikidata_entity_type, review_platforms, is_active

clients: id, tenant_id, vertical_id, name, brand_name, aliases,
  city, state, website_url, description, models, is_active

competitors: id, tenant_id, vertical_id, name, aliases, website_url, is_active

prompts: id, vertical_id, tenant_id, text, category, intent_type,
  buyer_stage, is_active, is_custom, priority

prompt_runs: id, prompt_id, client_id, engine, raw_response, ran_at,
  tokens_used, duration_ms, status, retry_count, error_message, cost_usd

brand_mentions: id, run_id, client_id, competitor_id, brand_name, position,
  sentiment, cited_url, context_snippet, is_client_brand

citation_sources: id, url, domain, domain_authority_score, schema_types_found,
  has_faq_schema, word_count, last_crawled_at

gap_reports: id, client_id, version, generated_at, on_site_gaps, off_site_gaps,
  top_cited_competitor_id, top_cited_domain, plain_english_summary,
  recommended_actions, previous_report_id

content_outputs: id, client_id, target_prompt_id, type, title, html_content,
  schema_json, generation_prompt, status, review_notes, approved_by,
  approved_at, published_at, citation_rate_before, citation_rate_after

review_audits: id, client_id, platform, rating, review_count, response_rate,
  last_checked_at, gap_vs_top_competitor

community_threads: id, client_id, platform, url, thread_title,
  is_client_mentioned, ai_citation_count, response_draft, response_status,
  detected_at, responded_at

weekly_briefs: id, client_id, week_of, citation_score, citation_delta,
  action_items, platform_actions_log, email_sent_at, actions_completed

notifications: id, tenant_id, client_id, type, severity, title, body,
  deep_link, is_read, email_sent

billing_events: id, tenant_id, event_type, amount_inr, razorpay_payment_id,
  plan_from, plan_to, created_at

---

## 9. Key System Flows

### Daily Prompt Run Cycle
```
2:00 AM IST  Scheduler fires
             For each active tenant: check quota
             For each active client: select active prompts
             Each (prompt, client, engine) x 6 = Bull queue job

Workers      Pull jobs, fire engine API, store PromptRun
             Emit extraction.requested event on completion

Extraction   Pull event, call Claude Haiku, parse JSON
             Create BrandMention records
             Update Redis citation cache
             Check anomaly thresholds -- create Notifications if breached

6:00 AM IST  Anomaly alert emails sent
             Dashboard cache warmed (pre-calculate 7-day scores)
```

### Monday Weekly Cycle
```
6:00 AM IST  WeeklyBrief job fires for all active clients
             Compute citation delta
             Rank all pending actions by impact score
             Select top 3 actions
             Generate brief via Claude Haiku
             Store WeeklyBrief
             Send email via SendGrid
             Push dashboard notification badge
             Auto-generate GapReport if needed
             Auto-generate content drafts for 3 worst-performing prompts
```

### Content Approval Flow
```
Trigger      tenant_admin selects gap prompt + content type + Generate

Pipeline     Load context: client, vertical, gap report, competitors
             Call Claude Sonnet with AEO system prompt
             Post-process: validate schema, quality rules, flag violations
             Store ContentOutput (draft)
             Notify client_manager

Review       client_manager: HTML preview in dashboard
             Approve / Request Revision (with notes) / Reject
             Revision: regenerate with review notes injected

Publish      Client downloads HTML, uploads to CMS
             Marks published in platform
             Platform records published_at
             60-day scheduled check: capture citation_rate_after
```

---

## 10. Development Phases

| Phase | Scope | Exit Criteria |
|-------|-------|---------------|
| 0 Foundation | NestJS CLI scaffold, Prisma schema, GEMINI.md, Docker, CI/CD, env config | Build passes, Docker runs, all E2E tests pass |
| 1 Auth and Tenancy | JWT RS256 MFA, tenant CRUD, client CRUD, RBAC, isolation | Auth E2E pass, tenant isolation penetration tested |
| 2 Verticals and Prompts | Vertical engine, 5 seeded verticals, prompt library, quota | All 5 verticals seeded, quota enforcement at limit tested |
| 3 Execution Engine | Prompt runner 6 engines, Bull queue, retry, DLQ, cost tracking | 1000 runs without failure, cost tracking accurate |
| 4 Extraction and Analytics | Extraction pipeline, citation scoring, share of voice, anomaly | Accuracy validated on 200 sample responses |
| 5 Dashboard | Next.js, all sections, charts, real-time refresh, responsive | All charts correct, load under 2 seconds, mobile functional |
| 6 Diagnostics | Gap report pipeline, URL crawler, schema extractor, summaries | Reports generated for 10 test clients, findings validated |
| 7 Content Agent | All 4 content types, quality validation, approval workflow | 50 pieces generated and reviewed by Srinivas, quality met |
| 8 Off-Site Builder | All 5 modules: aggregator, reviews, community, KG, PR | All modules tested on 3 Fidelitus internal brands |
| 9 Weekly Brief | Auto-generation, action ranking, email, action tracking | 4 consecutive Monday briefs correct for test clients |
| 10 Billing | Razorpay integration, plan enforcement, invoice, trial, upgrade | Full billing cycle in Razorpay test mode passes |
| 11 Notifications | All types, rate limiting, email, in-app badges | All triggers tested, spam condition tested |
| 12 Super Admin | Cross-tenant dashboard, health, cost, manual controls | Srinivas UAT sign-off |
| 13 Hardening | Load test 5x growth volume, penetration test, performance tuning | All perf targets met, zero critical security findings |
| 14 Beta | 5 design partners onboarded, monitoring, feedback, bug fixes | 5 clients active 4 weeks, NPS measured, critical bugs resolved |
| 15 Launch | Billing live, self-serve signup, support documented | First paying client onboarded without manual intervention |

---

## 11. Development Workflow

### Build Pipeline
```
Gemini CLI (D:\staging\aeo-platform)
  All phases from scaffold to production -- single tool, no separate playground
  Phase 0: nest new via NestJS CLI, Prisma schema hand-written and reviewed
  E2E tests: Jest + Supertest, written alongside each feature
  Frontend API client: typed fetch wrapper generated from NestJS Swagger spec
    via openapi-typescript (npx openapi-typescript openapi.json -o src/lib/api.d.ts)
  One phase per session, checkpoint written at phase end
  Never start next phase until exit criteria of current phase are met
```

### Model Routing Rules (non-negotiable)
```
Claude Haiku (claude-haiku-4-5-20251001)
  Brand mention extraction (high volume, structured JSON output)
  Weekly brief generation (structured, consistent, fast)
  Quota enforcement checks
  Any automated task fired more than 100 times per day

Claude Sonnet (claude-sonnet-4-20250514)
  Content generation (FAQ, comparison, entity, segment article)
  Gap report plain English summaries
  Community response drafts
  PR press release drafts
  Any task requiring quality prose

Claude Opus
  Architecture review sessions only
  Major phase design decisions
  Not used in any automated pipeline
  Use at most once per phase
```

### Repository Structure
```
aeo-suite/
  prisma/
    schema/           Prisma schema files
    migrations/       Migration history
    seed/             Vertical seed data and prompt library
  src/
    auth/             JWT, guards, TOTP MFA, refresh rotation
    tenants/          Tenant CRUD and plan management
    users/            User CRUD and invite flow
    verticals/        Vertical config engine CRUD
    clients/          Client CRUD and alias management
    competitors/      Competitor CRUD
    prompts/          Prompt library and quota enforcement
    prompt-engine/    Multi-engine execution and Bull queue
    extraction/       Brand mention extraction pipeline
    analytics/        Citation scoring, share of voice, anomaly detection
    diagnostics/      Gap report generation and URL crawler
    content-agent/    Content generation and approval workflow
    offsite/
      aggregator/     Aggregator profile monitor
      reviews/        Review velocity manager
      community/      Community thread monitor
      knowledge-graph/ Wikidata entity manager
      pr/             PR signal generator
    weekly-brief/     Brief generation and email delivery
    billing/          Razorpay integration and plan enforcement
    notifications/    Notification engine and rate limiting
    admin/            Super admin platform
    common/           Guards, interceptors, filters, tenant-scoped Prisma wrapper
  frontend/
    app/
      dashboard/      Client dashboard (Next.js App Router)
      admin/          Super admin views
      auth/           Login, signup, password reset
    components/       Shared UI components
    lib/              Type-safe API client (openapi-typescript generated)
  test/
    features/api/     E2E test suite (Jest + Supertest)
  docker-compose.yml           Local development
  docker-compose.prod.yml      Production override
  Dockerfile                   Multi-stage build
  .env.example                 All variables documented
  GEMINI.md                    Gemini CLI session context
  .github/
    workflows/
      ci.yml          Lint, test, build on every PR
      deploy.yml      Deploy to Render on merge to main
```

### Environment Variables
```
DATABASE_URL                  PostgreSQL connection string
REDIS_URL                     Redis connection string
JWT_PRIVATE_KEY               RS256 private key (base64 encoded)
JWT_PUBLIC_KEY                RS256 public key (base64 encoded)
JWT_EXPIRES_IN                Access token TTL (default 86400)
REFRESH_TOKEN_EXPIRES_IN      Refresh token TTL (default 2592000)
OPENAI_API_KEY                ChatGPT engine
ANTHROPIC_API_KEY             Claude engine, Haiku extraction, Sonnet content
GOOGLE_API_KEY                Gemini engine
PERPLEXITY_API_KEY            Perplexity engine
XAI_API_KEY                   Grok engine
SENDGRID_API_KEY              Email delivery
RAZORPAY_KEY_ID               Billing
RAZORPAY_KEY_SECRET           Billing
SENTRY_DSN                    Error tracking
ALLOWED_ORIGINS               CORS whitelist (comma separated)
NODE_ENV                      development or production
PORT                          API port (default 3000)
ENCRYPTION_KEY                AES-256 key for API key encryption at rest
DAILY_COST_ALERT_THRESHOLD    USD amount to trigger cost alert
```

---

## 12. Open Questions

| # | Question | Owner | Required By |
|---|----------|-------|-------------|
| 1 | Perplexity API -- cited URLs returned structured or need parsing from response text? | Dev | Phase 3 start |
| 2 | Which specific Indian aggregator URLs per vertical to seed? Research needed per vertical | Srinivas | Phase 2 start |
| 3 | Grok API -- stable production access or waitlist? Fallback strategy if unavailable? | Dev | Phase 3 start |
| 4 | Google AI Overviews via Playwright -- terms of service compliance? Consider legal review | Srinivas | Phase 3 start |
| 5 | Razorpay subscriptions -- does it natively support prorated plan upgrade billing? | Dev | Phase 10 start |
| 6 | Reddit monitoring -- official Reddit API (rate limited) or Playwright scraping? | Dev | Phase 8 start |
| 7 | Beta design partners -- which 5 clients from Fidelitus portfolio? Internal brands preferred | Srinivas | Phase 14 |
| 8 | INR pricing confirmed? Starter Rs 5K, Growth Rs 15K, Enterprise Rs 45K? | Srinivas | Phase 10 |
| 9 | SherpaVector white-label -- tenant-level branding or separate deployment? | Srinivas | Phase 12 |
| 10 | Token cost model -- run per-client monthly cost estimate at growth tier before pricing | Dev + Srinivas | Phase 3 complete |
| 11 | Playwright for Google AI Overviews -- residential proxy needed for bot detection? | Dev | Phase 3 |

---

## 13. Competitive Positioning

| | AEO Suite | Profound (US) | Peec AI (EU) | Otterly AI |
|---|---|---|---|---|
| Price | Rs 5K-45K/month | $99-1499/month USD | EUR 200+ | $29/month USD |
| Indian verticals | Native | No | No | No |
| Indian aggregators | Yes | No | No | No |
| Indian languages | Roadmap | No | Partial | No |
| Full stack (monitor + diagnose + execute) | Yes | Yes | Monitor only | Monitor only |
| Content generation | Yes | Yes (Agents) | No | No |
| Off-site authority builder | Yes | No | No | No |
| Weekly brief | Yes | No | No | No |
| Vertical-agnostic by config | Yes | No | No | No |
| Billing in INR | Yes | No | No | No |
| Multi-tenant agency model | Yes | Yes | Yes | Limited |
| Target market | India + South Asia | US enterprise | Europe | Global SMB |

---

*PRD Version 2.0 -- Production-grade, no MVP framing, no deferred features*
*Owner: Srinivas / Fidelitus Corp / SherpaVector*
*Build model: Solo developer + Gemini CLI*
*Next step: Produce project-start.ps1 + session-start.ps1 for Phase 0 scaffold*
