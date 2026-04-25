# TASK-008: Phase 8 — Off-Site Authority Builder

## Status: PLANNING
## Phase: 8
## Branch: feature/TASK-008 (create when TASK-007 exits)

## Objective
Five off-site authority modules that monitor, diagnose, and generate ready-to-use outputs for aggregator profiles, reviews, community threads, knowledge graph entities, and PR signals. Tested on 3 Fidelitus internal brands.

## Scope
- `src/offsite/aggregator/` — Module A: aggregator profile monitor
- `src/offsite/reviews/` — Module B: review velocity manager
- `src/offsite/community/` — Module C: community presence monitor
- `src/offsite/knowledge-graph/` — Module D: Wikidata entity manager
- `src/offsite/pr/` — Module E: PR signal generator

## Exit Criteria
- [ ] Module A: weekly crawl of each aggregator, completeness score 0-100, competitor comparison, profile update pack generated
- [ ] Module A: alert on competitor profile content hash change
- [ ] Module B: review count + rating tracked across all configured platforms, review request kit (WhatsApp/SMS/email/QR) generated
- [ ] Module B: negative review detected within 1 hour, de-escalation draft generated
- [ ] Module C: subreddit/forum monitoring for prompt-equivalent questions, competitor-mentioned + client-absent detection
- [ ] Module C: high-value threads (cited 5+ times) trigger urgent alert
- [ ] Module C: authentic response draft generated (helpful first, no promo language)
- [ ] Module D: Wikidata entity check, missing entity submission draft generated
- [ ] Module E: RSS monitoring of vertical trusted domains, PR angle + press release draft generated
- [ ] All 5 modules tested on 3 Fidelitus internal brands, findings validated

## Dependencies
- TASK-007 exit criteria met
- Open Question #6: Reddit API vs Playwright (Dev)

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
| Aggregator crawler (Playwright) | TODO | — | Completeness scoring |
| Aggregator profile update pack generator | TODO | — | |
| Review platform monitors | TODO | — | Google Places API + verticals |
| Review request kit generator | TODO | — | WhatsApp/SMS/email/QR |
| Negative review detector + responder | TODO | — | |
| Community thread monitor | TODO | — | Reddit API or Playwright |
| Response draft generator | TODO | — | Claude Sonnet |
| Wikidata entity checker | TODO | — | |
| Wikidata submission draft generator | TODO | — | |
| PR RSS monitor | TODO | — | Vertical trusted domain feeds |
| Press release draft generator | TODO | — | Inverted pyramid |
| 3 Fidelitus brand test run | TODO | — | Srinivas validates all modules |
