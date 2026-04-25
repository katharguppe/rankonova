# TASK-015: Phase 15 — Launch

## Status: PLANNING
## Phase: 15
## Branch: feature/TASK-015 (create when TASK-014 exits)

## Objective
Commercial launch. Billing live in production. Self-serve signup without manual intervention. Support documentation complete. First paying client onboarded end-to-end without Srinivas touching anything.

## Scope
- Production Razorpay live keys activated
- Self-serve signup flow (no invite required)
- Support documentation (help center, onboarding guide)
- Public-facing pricing page
- Monitoring and alerting for production traffic

## Exit Criteria
- [ ] Razorpay live keys active, real payment processed end-to-end
- [ ] Self-serve signup: new user registers, verifies email, selects plan, pays, onboards first client — zero manual steps
- [ ] Trial signup: no credit card, 14-day Growth access, automatic emails at D+7, D+12, D+14
- [ ] Pricing page live with correct INR amounts (Starter Rs 5K, Growth Rs 15K, Enterprise Rs 45K)
- [ ] Support documentation: onboarding guide, FAQ, vertical setup guide published
- [ ] Uptime monitoring and alerting active (PagerDuty or equivalent)
- [ ] First paying client onboarded without manual intervention by Srinivas
- [ ] Srinivas can view first client in super admin dashboard
- [ ] Post-launch: daily cost monitoring active, alert thresholds configured

## Dependencies
- TASK-014 exit criteria met
- Open Question #8: INR pricing confirmed (Srinivas)
- Open Question #9: White-label architecture decision (Srinivas)
- Razorpay live account approved

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
| Razorpay live keys configured | TODO | — | Not in repo |
| Self-serve signup flow | TODO | — | |
| Pricing page (public) | TODO | — | INR amounts |
| Onboarding documentation | TODO | — | |
| Support FAQ | TODO | — | |
| Production uptime monitoring | TODO | — | 99.9% target |
| Production cost alerting | TODO | — | Per tenant per engine |
| First paying client test | TODO | — | End-to-end without Srinivas |
| Launch declared | TODO | — | |
