# Billing Module Design — TASK-010 Phase 10
Date: 2026-05-13  
Status: Approved

## Objective

Fully automated billing via Razorpay. No manual invoicing. Plan enforcement real-time. Trial lifecycle, upgrade/downgrade, cancellation, failed payment retry with suspension (not deletion). Full billing cycle verified in Razorpay test mode.

## Plans (INR, monthly recurring)

| Plan       | Price      | Clients    | Engines     | Runs/day   |
|------------|------------|------------|-------------|------------|
| Starter    | Rs 5,000   | 1          | 4           | 500        |
| Growth     | Rs 15,000  | 10         | All         | 5,000      |
| Enterprise | Rs 45,000  | Unlimited  | Unlimited   | Unlimited  |

## Open Questions Resolved

**Q: Does Razorpay support prorated upgrade billing natively?**  
**A: No.** Razorpay Subscriptions applies plan changes at the next billing cycle. Decision: upgrade grants immediate feature access but new price applies at next cycle. No prorated charge. Simpler, fully supported.

## Schema Change

Add one field to `Tenant` in `prisma/schema/schema.prisma`:

```prisma
billing_suspended Boolean @default(false)
```

`is_active` is used for email verification and admin deactivation — not safe to reuse for billing suspension. `billing_suspended` is the authoritative field checked by the 402 guard.

No new tables. `BillingEvent` and all enums (`BillingEventType`, `PlanTier`) are already modelled.

## Architecture: Layered Services inside BillingModule

All services live in `app/billing/`. `BillingModule` exports `BillingService` as the single public API for other modules.

### Services

**`SubscriptionService`**
- `createSubscription(tenantId, planTier)` — calls `IRazorpayService.createSubscription`, stores `razorpay_subscription_id` on tenant, writes `subscription_created` billing event
- `cancelSubscription(tenantId)` — calls Razorpay cancel, writes `subscription_cancelled` event, enqueues 90-day purge Bull job
- `changePlan(tenantId, newTier)` — updates `plan_tier` immediately (feature access), queues Razorpay plan switch for next billing cycle, writes `plan_upgraded` or `plan_downgraded` event

**`WebhookService`**
- `handleWebhook(rawBody, signature)` — verifies HMAC-SHA256 with `RAZORPAY_WEBHOOK_SECRET`
- `onPaymentCaptured` — delegates to `InvoiceService`
- `onSubscriptionHalted` — enqueues retry Bull jobs (D+1, D+3, D+7)
- `onSubscriptionCancelled` — suspends tenant via `PlanEnforcementService`

**`TrialService`**
- `startTrial(tenantId)` — sets `trial_ends_at = now + 14d`, `plan_tier = growth`, writes `trial_started` event, enqueues Bull jobs for D+7, D+12, D+14 reminder emails
- `endTrial(tenantId)` — drops `plan_tier` to `starter`, writes `trial_ended` event; paywall enforced by `PlanEnforcementService` at D+14

**`InvoiceService`**
- `generateAndSend(tenantId, paymentId, amountInr)` — builds PDF via pdfkit, attaches to nodemailer email, sends to `tenant.billing_email`, writes `payment_succeeded` event

**`PlanEnforcementService`**
- `assertNotSuspended(tenantId)` — throws `HttpException(402)` if `billing_suspended = true`
- `suspendTenant(tenantId)` — sets `billing_suspended = true`
- `unsuspendTenant(tenantId)` — sets `billing_suspended = false` on payment recovery
- `assertWithinQuota(tenantId)` — compares today's prompt run count against `prompt_quota_daily`

**`BillingService`** (existing, thin orchestrator)
- Wires the above; exported for other modules (`startTrial`, `assertNotSuspended`, `assertWithinQuota`)

### 402 Guard

`BillingGuard` implements `CanActivate`, calls `PlanEnforcementService.assertNotSuspended`. Applied globally except `billing/*` and `auth/*` routes.

## API Endpoints

All under `/billing`. JWT auth guard on all except webhook.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/billing/subscribe` | Create Razorpay subscription for a paid plan |
| `POST` | `/billing/cancel` | Self-serve cancellation |
| `PATCH` | `/billing/plan` | Upgrade or downgrade plan tier |
| `POST` | `/billing/trial/start` | Begin 14-day trial on tenant signup |
| `GET`  | `/billing/status` | Returns `plan_tier`, `billing_suspended`, `trial_ends_at` |
| `POST` | `/billing/webhook/razorpay` | Razorpay webhook — HMAC verified, no JWT |

## Async Jobs (Bull)

| Job | Trigger | Action |
|-----|---------|--------|
| `trial.reminder.d7` | D+7 from trial start | Send D+7 reminder email |
| `trial.reminder.d12` | D+12 from trial start | Send D+12 warning email |
| `trial.end` | D+14 from trial start | Call `TrialService.endTrial` |
| `payment.retry.d1` | D+1 from `subscription.halted` | Re-attempt payment |
| `payment.retry.d3` | D+3 from `subscription.halted` | Re-attempt payment |
| `payment.retry.d7` | D+7 from `subscription.halted` | Final retry; if still halted → `suspendTenant` |
| `tenant.purge` | D+90 from cancellation | Hard-delete tenant data |

## Trial Lifecycle

- Signup → `POST /billing/trial/start` → 14 days Growth features, no card required
- D+7: reminder email
- D+12: warning email
- D+14: `plan_tier` drops to starter, paywall shown; tenant enters card → `POST /billing/subscribe`

## Failed Payment Lifecycle

1. Razorpay fires `subscription.halted`
2. WebhookService enqueues retry jobs D+1, D+3, D+7
3. Each retry attempts `capturePayment`; on success → `unsuspendTenant` + invoice
4. D+7 no recovery → `suspendTenant` → all non-billing endpoints return 402

## Cancellation

- `POST /billing/cancel` → Razorpay subscription cancelled → `billing_suspended = true` → 90-day purge job enqueued
- Data retained 90 days, access suspended immediately

## Plan Change Rules

| Scenario | Feature access | Billing |
|----------|---------------|---------|
| Upgrade (e.g. Starter → Growth) | Immediate | New price at next cycle |
| Downgrade (e.g. Growth → Starter) | Next cycle | New price at next cycle |

## Testing Strategy

**Unit tests** (Jest, mocked Prisma + `IRazorpayService` stub):
- `SubscriptionService`: creation, cancellation, plan change → correct billing events written
- `WebhookService`: HMAC passes/fails, correct handler dispatched per event type
- `TrialService`: `startTrial` sets correct `trial_ends_at`, enqueues exactly 3 Bull jobs at correct delays
- `InvoiceService`: pdfkit called with correct data, `MailService.sendInvoiceEmail` called once
- `PlanEnforcementService`: 402 thrown when suspended, passes when not; suspend/unsuspend toggle field

**E2E / integration tests** (Razorpay stub, test DB):
- Happy path: signup → trial → D+14 paywall → subscribe → `payment.captured` → invoice emailed
- Failed payment: `subscription.halted` → retries → D+7 no recovery → suspended → 402
- Cancellation: cancel → purge job enqueued → 90-day retention

**Webhook test utility:** `signWebhookPayload(secret, body)` helper produces valid `X-Razorpay-Signature` for tests without live Razorpay.

## Exit Criteria (from TASK-010)

- [ ] Subscription creation on tenant signup
- [ ] `payment.captured` → invoice PDF emailed
- [ ] Failed payment retry D+1, D+3, D+7 then suspend
- [ ] Suspended tenant → 402 on all non-billing endpoints
- [ ] 14-day trial with Growth features
- [ ] Trial email sequence D+7, D+12, D+14
- [ ] Plan upgrade: immediate access, new price next cycle
- [ ] Plan downgrade: next cycle
- [ ] Self-serve cancellation, 90-day data retention
- [ ] All billing events written to `billing_events`
- [ ] Full cycle passes in Razorpay test mode
