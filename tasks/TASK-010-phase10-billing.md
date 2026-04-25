# TASK-010: Phase 10 — Billing

## Status: PLANNING
## Phase: 10
## Branch: feature/TASK-010 (create when TASK-009 exits)

## Objective
Fully automated billing via Razorpay. No manual invoicing. Plan enforcement real-time. Trial lifecycle, upgrade/downgrade, cancellation, failed payment retry with suspension (not deletion). Full billing cycle in Razorpay test mode before exit.

## Scope
- `src/billing/` — Razorpay integration, subscription lifecycle, invoice generation, plan enforcement, trial management, webhook handler

## Exit Criteria
- [ ] Subscription creation: Razorpay subscription created on tenant signup
- [ ] Payment success: invoice PDF auto-generated and emailed
- [ ] Failed payment: retry D+1, D+3, D+7 then tenant suspended (not deleted)
- [ ] Suspended tenant: API returns 402 on all non-billing endpoints
- [ ] Trial: 14 days Growth features, no credit card required
- [ ] Trial email sequence: D+7, D+12, D+14 emails sent at correct intervals
- [ ] Trial-to-paid upgrade: immediate full access, prorated billing correct
- [ ] Plan upgrade (Starter→Growth): immediate access, prorated charge in Razorpay test
- [ ] Plan downgrade (Growth→Starter): takes effect next billing cycle, limits enforced
- [ ] Self-serve cancellation: data retained, access suspended, 90-day purge scheduled
- [ ] All billing events written to `billing_events` table
- [ ] Full end-to-end billing cycle passes in Razorpay test mode

## Dependencies
- TASK-009 exit criteria met
- Open Question #5: Razorpay prorated upgrade support (Dev)
- Open Question #8: INR pricing confirmed (Srinivas)
- Razorpay test API keys configured

## PDCA Log

### Cycle 1
**Plan:**
**Approved:** Pending
**Do:**
**Check:**
**Act:**

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Razorpay SDK integration | TODO | — | |
| Subscription creation on signup | TODO | — | |
| Webhook handler (all events) | TODO | — | Signature verification |
| Payment success → invoice PDF | TODO | — | |
| Failed payment retry logic | TODO | — | D+1, D+3, D+7 |
| Tenant suspension on payment failure | TODO | — | |
| 402 guard for suspended tenants | TODO | — | |
| Trial lifecycle (14 days) | TODO | — | |
| Trial email sequence | TODO | — | SendGrid templates |
| Plan upgrade (prorated) | TODO | — | |
| Plan downgrade (next cycle) | TODO | — | |
| Self-serve cancellation | TODO | — | 90-day purge schedule |
| billing_events writer | TODO | — | All lifecycle events |
| Full cycle E2E in test mode | TODO | — | |
