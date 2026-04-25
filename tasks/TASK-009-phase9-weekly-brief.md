# TASK-009: Phase 9 — Weekly Brief

## Status: PLANNING
## Phase: 9
## Branch: feature/TASK-009 (create when TASK-008 exits)

## Objective
Every Monday 6AM IST: one-page action digest per client. Maximum 3 actions. Every action has a pre-generated draft. Scannable in 90 seconds. Sent via SendGrid. 4 consecutive correct briefs before exit.

## Scope
- `src/weekly-brief/` — generation pipeline, action ranker, email sender, action tracker

## Exit Criteria
- [ ] Brief generates every Monday 6AM IST for all active clients
- [ ] Citation delta computed correctly vs previous week
- [ ] Action ranking by estimated citation impact correct (verified manually)
- [ ] Exactly 3 actions selected regardless of backlog size
- [ ] Every action has pre-generated draft (no blank tasks)
- [ ] Email sent via SendGrid, received in under 2 minutes
- [ ] Dashboard notification badge triggered on brief generation
- [ ] Auto-generates GapReport if citation dropped (linked to TASK-006 trigger)
- [ ] Auto-generates 3 content drafts for worst-performing prompts (linked to TASK-007)
- [ ] `actions_completed` increments correctly when client marks action done
- [ ] 4 consecutive Monday briefs correct for test clients (Srinivas sign-off)

## Dependencies
- TASK-008 exit criteria met
- SendGrid API key configured

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
| Monday 6AM IST cron job | TODO | — | |
| Citation delta calculator | TODO | — | vs previous WeeklyBrief |
| Action ranker (all pending actions) | TODO | — | By citation impact score |
| Top-3 selector | TODO | — | Hard limit |
| Brief text generator (Claude Haiku) | TODO | — | Structured, fast |
| WeeklyBrief DB writer | TODO | — | @@unique(client_id, week_of) |
| SendGrid email sender | TODO | — | Delivery <2min verified |
| Dashboard notification trigger | TODO | — | Badge on brief creation |
| Auto-GapReport trigger | TODO | — | On citation drop |
| Auto-content-draft trigger | TODO | — | 3 worst prompts |
| Action completion tracker | TODO | — | |
| 4-week consecutive test | TODO | — | Srinivas review |
