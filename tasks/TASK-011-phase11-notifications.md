# TASK-011: Phase 11 — Notifications

## Status: PLANNING
## Phase: 11
## Branch: feature/TASK-011 (create when TASK-010 exits)

## Objective
In-app and email notifications across all severity tiers. Rate-limited (same type max 1/4h per client). Critical alerts immediate. High alerts daily digest. All triggers tested including spam prevention.

## Scope
- `src/notifications/` — notification engine, rate limiter, email dispatcher, in-app badge sync

## Exit Criteria
- [ ] Critical (immediate email + in-app): citation drop, competitor spike, negative review 24h, payment failed, prompt failure rate >20%/hr
- [ ] High (daily digest + in-app): new community thread, content draft ready, gap report, new competitor citation domain
- [ ] Medium (weekly brief only): aggregator score <60, review backlog >20, PR opportunity
- [ ] Rate limit: same type per client max 1 per 4 hours (Redis-backed, verified)
- [ ] Spam test: 100 rapid citation_drop events for same client → only 1 email sent in 4h window
- [ ] Email delivery via SendGrid under 2 minutes
- [ ] `is_read` toggles correctly from dashboard
- [ ] `email_sent` flag set on successful SendGrid delivery
- [ ] All 10+ trigger points wired correctly across modules

## Dependencies
- TASK-010 exit criteria met (billing notifications in scope)
- All prior modules have notification trigger points ready

## PDCA Log

### Cycle 1
**Plan:** 
Brainstorming completed 2026-05-14. Design: event-driven (EventEmitter2), event handlers route by severity, Critical=immediate email, High=daily digest cron @9AM IST, Medium=weekly brief only. Rate limit (Redis): 4h per type/client, Critical bypasses. In-app: SWR polling /notifications/unread-count every 30s. Nodemailer/SMTP (SendGrid relay). Full design saved to memory/project_task011_brainstorm.md.

**Approved:** Pending (user approval on 5 design sections before spec writing)
**Do:**
**Check:**
**Act:**

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Notification service (create/read/mark-read) | TODO | — | |
| Rate limiter (Redis, 4h window) | TODO | — | |
| Critical notification handler | TODO | — | Immediate email + in-app |
| High notification handler | TODO | — | Daily digest batch |
| Medium notification handler | TODO | — | Weekly brief only |
| SendGrid email templates | TODO | — | Per severity/type |
| In-app badge count API | TODO | — | |
| Citation drop trigger wiring | TODO | — | From analytics |
| Competitor spike trigger wiring | TODO | — | From analytics |
| Payment failed trigger wiring | TODO | — | From billing |
| Prompt failure rate trigger | TODO | — | From execution engine |
| Content draft ready trigger | TODO | — | From content agent |
| All triggers E2E tested | TODO | — | |
| Spam condition test | TODO | — | 100 rapid events → 1 email |
