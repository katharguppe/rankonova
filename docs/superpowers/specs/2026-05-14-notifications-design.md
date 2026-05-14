# TASK-011: Phase 11 — Notifications System Design

**Date:** 2026-05-14  
**Phase:** 11  
**Module Scope:** `app/notifications/` only  
**Status:** Design approved, ready for implementation planning

## Overview

An event-driven notification and alert system that routes domain events from analytics, billing, content-agent, and prompt-engine modules into a unified notification engine. Notifications are delivered with severity-aware timing: Critical alerts sent immediately, High alerts batched in a daily digest at 9 AM IST, and Medium alerts routed to the weekly brief only. Rate limiting prevents spam while ensuring critical alerts bypass delays.

## Architecture

**Four-layer event-driven system:**

1. **Event Layer** — Domain modules emit typed events (`citation.drop`, `payment.failed`, `content.draft_ready`, etc.)
2. **Handler Layer** — Centralized `NotificationHandler` listens to all events, creates `Notification` records, and routes by severity
3. **Delivery Layer** — Routes by severity:
   - **Critical**: Sent immediately via email + in-app notification
   - **High**: Batched and sent via daily digest cron job at 9 AM IST
   - **Medium**: Included in weekly brief only (no separate email)
4. **Rate Limiting Layer** — Redis-backed rate limiter (`notif:${clientId}:${type}:${severity}`) prevents duplicate alerts within 4-hour windows. Critical severity always bypasses rate limits.

## Data Model

**Notification Entity** (existing in Prisma schema):
```typescript
model Notification {
  id          String   @id @default(cuid())
  tenant_id   String
  client_id   String
  type        String   // citation_drop, competitor_spike, etc.
  severity    String   // critical, high, medium
  title       String
  body        String?
  deep_link   String?  // Links to relevant dashboard section
  is_read     Boolean  @default(false)
  email_sent  Boolean  @default(false)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  
  @@index([tenant_id])
  @@index([client_id])
  @@index([tenant_id, is_read])
  @@index([client_id, created_at])
}
```

**Rate Limit Storage** (Redis only, no persistence):
- Key format: `notif:${clientId}:${type}:${severity}`
- Value: timestamp of last sent notification
- TTL: 4 hours (14400 seconds)

## Core Components

### NotificationService
Handles all notification CRUD and query operations:
- `create(clientId, type, severity, title, body, deepLink)` → Creates and returns Notification
- `findAll(clientId)` → List all notifications for a client
- `markAsRead(id)` → Set `is_read=true`
- `findBatchableHigh(since: DateTime)` → Query unsent High notifications from past 24h, grouped by client
- `markDigestSent(ids: string[])` → Bulk set `email_sent=true` after digest send

### NotificationHandler
Event listener that routes domain events to the delivery layer:
- Listens via `@OnEvent` to all notification-triggering events
- Creates Notification record for each event
- Calls delivery layer based on severity:
  - **Critical**: `await emailService.sendImmediate(notification)`
  - **High**: Queues in memory (digest cron will batch and send)
  - **Medium**: Stores only (routed to weekly brief elsewhere)
- Respects rate limiting (blocked events logged, not stored)

### RateLimiter
Redis-backed rate limiting service:
- `canSend(clientId, type, severity)` → Returns `{allowed: boolean, secondsUntilNext?: number}`
- Critical severity always returns `{allowed: true}`
- High/Medium severity checks Redis key; if exists and within 4 hours, blocks
- On allow, sets Redis key with 4-hour TTL

### DigestCronJob
Daily digest batch processor:
- Runs at `0 9 * * *` (9 AM IST)
- Queries `findBatchableHigh(since: 24 hours ago)`
- Groups results by client
- For each client, renders HTML email template with all notifications
- Sends via SendGrid (via existing MailService)
- Marks all sent notifications with `email_sent=true`
- Logs batch summary (clients, count)

## API Endpoints

All endpoints are tenant-scoped and require valid `clientId` in query parameters or token.

### Public Endpoints

**GET `/notifications?clientId=X`**
- Returns all notifications for the client
- Query params:
  - `clientId` (required): Client UUID
  - `limit` (optional, default 50): Pagination limit
  - `offset` (optional, default 0): Pagination offset
- Response: `{ data: Notification[], total: number, unreadCount: number }`
- Order: `created_at DESC`

**GET `/notifications/unread-count?clientId=X`**
- Returns unread notification count for badge display
- Query params:
  - `clientId` (required): Client UUID
- Response: `{ unreadCount: number }`
- Used by frontend SWR polling every 30 seconds

**PATCH `/notifications/:id/read`**
- Marks a notification as read
- Request body: `{ is_read: boolean }`
- Response: Updated `Notification` record
- Idempotent: can be called multiple times safely

### Internal Endpoints (Not Exposed to Clients)

**GET `/notifications/batch-high?since=<ISO8601>`**
- Used by DigestCronJob to fetch unsent High notifications
- Returns paginated results grouped by client for batch processing

**POST `/notifications/send-digest` (Optional)**
- Manual trigger for testing digest generation
- Calls DigestCronJob logic without waiting for scheduled time
- Request body: `{ dryRun?: boolean }`

## Notification Types and Triggers

### Critical (Immediate Email + In-App)
- `citation_drop` — Citation rate drops >10 points in 24h (from Analytics)
- `competitor_spike` — Competitor mentions spike >15 points (from Analytics)
- `negative_review_24h` — Unanswered negative review for >24h (from Analytics)
- `payment_failed` — Payment failed during subscription renewal (from Billing)
- `prompt_failure_rate` — Prompt run failure rate >20% in 1h window (from Prompt Engine)

### High (Daily Digest @ 9 AM IST)
- `community_thread` — New community thread mentioning client, AI citation present (from Offsite)
- `content_draft_ready` — Content draft generated and awaiting review (from Content Agent)
- `gap_report` — New gap report generated (from Analytics)
- `competitor_domain` — New competitor citation source domain found (from Analytics)

### Medium (Weekly Brief Only)
- `aggregator_score` — Aggregator score drops below 60 (from Offsite)
- `review_backlog` — Unanswered review backlog exceeds 20 customers (from Offsite)
- `pr_opportunity` — PR opportunity detected (from Offsite)

## Rate Limiting

**Rate Limit Logic:**
- Key: `notif:${clientId}:${type}:${severity}`
- Scope: Same notification type per client
- Window: 4 hours (14400 seconds)
- Exception: Critical severity bypasses rate limit (always sent)

**Behavior:**
- If rate limit check fails, event is logged (not stored as notification)
- Admin dashboard can view rate-limited events in diagnostics
- Testing: 100 rapid `citation_drop` events → only 1 email sent, remaining queued as High notifications

## In-App Notification UI

**Badge Count Polling:**
- Frontend calls `GET /notifications/unread-count?clientId=X` every 30 seconds via SWR
- Updates in-app badge count in real-time
- No WebSocket needed; polling pattern matches existing dashboard

**Notification List:**
- Fetched on-demand via `GET /notifications?clientId=X`
- Displayed in reverse chronological order
- Mark-read toggles `is_read` flag instantly

**Deep Links:**
- Each notification includes optional `deep_link` (e.g., `/dashboard/clients/X/analytics#citation-drop`)
- Clicking notification navigates to relevant section

## Email Templates

SendGrid template per notification type:
- **Critical templates** (5): citation_drop, competitor_spike, negative_review_24h, payment_failed, prompt_failure_rate
- **High templates** (4): community_thread, content_draft_ready, gap_report, competitor_domain
- **Digest template** (1): Daily digest wrapper listing all High notifications for the day
- **Fallback template** (1): Plain text if type-specific template missing

All templates include:
- Client-specific branding (tenant logo, colors)
- Notification title and body
- Deep link CTA button
- Unsubscribe link

## Testing Strategy

### Unit Tests (Notifications, RateLimiter)
- CRUD operations: create, read, markAsRead, findBatchableHigh
- Rate limiter: blocks same type within 4h, allows after expiry, Critical always passes
- Digest query: filters unsent High notifications from past 24h correctly

### Integration Tests (Event → Handler → DB → Email)
- Event emitted → Notification record created in DB
- Critical event → Email triggered immediately via SendGrid
- High event → Queued for digest, not sent immediately
- Medium event → Stored only, not sent separately
- Rate limit blocks duplicate records
- Email marked `email_sent=true` after successful delivery

### E2E Tests (Full Workflow)
1. **Spam Test**: Emit 100 rapid `citation_drop` events for same client → Verify only 1 email sent in 4h window, remaining notifications queued as High
2. **Digest Generation**: Emit 5 High notifications, trigger cron manually → Verify 1 batched email sent, all marked `email_sent=true`
3. **Dashboard Polling**: Fetch unread count, mark-read → Verify badge updates in real-time via SWR
4. **Rate Limit Expiry**: Wait 4h (mocked in tests) → Verify next identical event is sent

### Manual Testing Checklist
- Dashboard badge updates every 30s ✓
- Mark-read toggles notification in UI ✓
- All 12 SendGrid templates render correctly ✓
- Deep links navigate to correct dashboard section ✓
- Digest email contains correct client branding ✓

## Dependencies and Integrations

**Internal Dependencies:**
- `app/mail/` — MailService for SendGrid email delivery
- `app/analytics/` — Emits citation_drop, competitor_spike, negative_review_24h, gap_report, competitor_domain events
- `app/billing/` — Emits payment_failed events
- `app/content-agent/` — Emits content_draft_ready events
- `app/prompt-engine/` — Emits prompt_failure_rate events
- `app/offsite/` — Emits community_thread, aggregator_score, review_backlog, pr_opportunity events

**External Dependencies:**
- Redis 7 — Rate limiting and session storage
- SendGrid — Email delivery via MailService

**Framework:**
- NestJS — Event emitter (@nestjs/event-emitter, EventEmitter2)
- Prisma 7 — ORM
- TypeScript 5.x

## Exit Criteria Checklist

- [ ] NotificationService CRUD implemented (create, read, markAsRead, findBatchableHigh, markDigestSent)
- [ ] RateLimiter logic implemented (Redis 4h window, Critical bypass)
- [ ] NotificationHandler listening to all 12 notification types
- [ ] DigestCronJob sending daily batched emails at 9 AM IST
- [ ] All 3 API endpoints implemented and tested
- [ ] All 5 trigger points wired from source modules
- [ ] SendGrid templates for all 12 notification types
- [ ] Unit tests: 15+ (CRUD, rate limiter, digest query)
- [ ] Integration tests: 10+ (event flow, email delivery)
- [ ] E2E tests: 4+ (spam, digest, polling, rate limit expiry)
- [ ] Spam condition verified: 100 rapid events → 1 email in 4h
- [ ] Email delivery under 2 minutes via SendGrid
- [ ] Dashboard badge polling working (30s SWR interval)
- [ ] All tests green, 0 tsc errors, linter clean

## File Structure

```
app/notifications/
├── notifications.controller.ts      (3 public + 2 internal endpoints)
├── notifications.service.ts         (CRUD, query logic)
├── notifications.module.ts          (module setup)
├── notification.handler.ts          (event listeners)
├── rate-limiter.service.ts          (Redis-backed rate limiting)
├── digest-cron.job.ts               (daily 9 AM IST batch job)
├── notifications.types.ts           (TypeScript interfaces)
├── __tests__/
│   ├── notifications.service.spec.ts
│   ├── rate-limiter.service.spec.ts
│   ├── notification.handler.spec.ts
│   ├── digest-cron.job.spec.ts
│   └── notifications.e2e.spec.ts
└── templates/                       (optional, if storing locally)
    └── digest.hbs                   (fallback template)
```

## Implementation Order

1. **Phase 1**: NotificationService CRUD + Notification data model validation
2. **Phase 2**: RateLimiter service (Redis-backed)
3. **Phase 3**: API endpoints (3 public + 2 internal)
4. **Phase 4**: NotificationHandler (event listeners)
5. **Phase 5**: DigestCronJob (daily 9 AM IST)
6. **Phase 6**: SendGrid template integration + email delivery wiring
7. **Phase 7**: Trigger point wiring (analytics, billing, content-agent, prompt-engine, offsite)
8. **Phase 8**: Unit + integration + E2E tests
9. **Phase 9**: Manual testing + bug fixes
10. **Phase 10**: Code review + merge to main

## Notes

- **Idempotency**: All endpoints are idempotent; can be called multiple times safely
- **Tenant Scoping**: All endpoints enforce tenant scoping via token or query parameter
- **Error Handling**: SendGrid delivery failures logged but don't break the pipeline (resilient)
- **Scalability**: Event emitter is in-process; if high volume, consider Redis-backed queue in future phases
- **Backwards Compatibility**: No schema changes to existing tables; Notification is new entity only
