# TASK-008: Phase 8 — Off-Site Authority Builder

## Status: BACKEND COMPLETE — Frontend sprint + Fidelitus brand test pending
## Phase: 8
## Branch: main (all commits merged)

## Objective
Five off-site authority modules that monitor, diagnose, and generate ready-to-use outputs for aggregator profiles, reviews, community threads, knowledge graph entities, and PR signals. Tested on 3 Fidelitus internal brands.

## Scope
- `app/offsite/aggregator/` — Module A: aggregator profile monitor
- `app/offsite/reviews/` — Module B: review velocity manager
- `app/offsite/community/` — Module C: community presence monitor
- `app/offsite/knowledge-graph/` — Module D: Wikidata entity manager
- `app/offsite/pr/` — Module E: PR signal generator

## Exit Criteria
- [x] Module A: weekly crawl of each aggregator, completeness score 0-100, competitor comparison, profile update pack generated
- [x] Module A: alert on competitor profile content hash change
- [x] Module B: review count + rating tracked across all configured platforms, review request kit (WhatsApp/SMS/email/QR) generated
- [x] Module B: negative review detected within 1 hour, de-escalation draft generated
- [x] Module C: subreddit/forum monitoring for prompt-equivalent questions, competitor-mentioned + client-absent detection
- [x] Module C: high-value threads (cited 5+ times) trigger urgent alert
- [x] Module C: authentic response draft generated (helpful first, no promo language)
- [x] Module D: Wikidata entity check, missing entity submission draft generated
- [x] Module E: RSS monitoring of vertical trusted domains, PR angle + press release draft generated
- [ ] All 5 modules tested on 3 Fidelitus internal brands, findings validated — PENDING Sir input

## Dependencies
- TASK-007 exit criteria met — DONE
- Open Question #6: Reddit API vs Playwright — RESOLVED: Reddit JSON API (500ms delay) for Reddit; Playwright for generic platforms

## PDCA Log

### Cycle 1 — Module A: Aggregator Profile Monitor
**Plan:** Playwright scraper for CarDekho/ZigWheels/JustDial; completeness score 0-100; competitor comparison; profile update pack; daily cron.
**Approved:** Yes
**Do:** Implemented `aggregator.service.ts`, `aggregator.controller.ts`, updated module, seeded CSS selectors for Automotive + Healthcare verticals, wrote smoke test.
**Check:** Smoke test PASS — CarDekho 33.33%, ZigWheels 33.33% completeness on stress client.
**Act:** Committed `c77bc177`

### Cycle 2 — Module B: Review Velocity Manager
**Plan:** Playwright review scraper; ReviewAudit aggregate stats; ReviewSnapshot per review; negative detection + Cerebras draft; RequestKit with SVG QR code; hourly cron for negatives.
**Approved:** Yes (Playwright for all platforms, pure SVG QR code trade-offs accepted)
**Do:** Implemented `reviews.service.ts`, `reviews.controller.ts`, updated module; added `ReviewAudit`, `ReviewSnapshot`, `ReviewRequestKit` models; wrote smoke test.
**Check:** Smoke test run; models migrated and Prisma client regenerated.
**Act:** Committed `6e5d306d`

### Cycle 3 — Module C: Community Presence Monitor
**Plan:** Reddit JSON API (500ms delay) for Reddit; Playwright generic fallback; signal detection (client alias / competitor alias substring match); Cerebras draft for opportunity threads; daily cron.
**Approved:** Yes (500ms Reddit delay explicitly confirmed)
**Do:** Implemented `community.service.ts`, `community.controller.ts`, updated module; extended `CommunityThread` schema with scoring fields and indexes; wrote smoke test.
**Check:** Smoke test PASS — auth guard, run, threads, opportunities, draft, posted, skipped all 200.
**Act:** Committed `e814f582`

### Cycle 4 — Module D: Knowledge Graph Entity Manager
**Plan:** Wikidata SPARQL endpoint (no auth); GKP via Playwright headless Google search; Wikipedia notability via inlinks count proxy (>5 = threshold_met); monthly cron; diff vs previous check; notification on status_changed.
**Approved:** Yes (SPARQL accuracy, Playwright GKP, inlinks proxy accepted)
**Do:** Implemented `knowledge-graph.service.ts`, `knowledge-graph.controller.ts`, updated module; added `EntityCheck` model; wrote smoke test.
**Check:** Smoke test PASS — run, latest, history, auth guard all 200.
**Act:** Committed `5c19c6c7`

### Cycle 5 — Module E: PR Signal Generator
**Plan:** fast-xml-parser for RSS (RSS 2.0 + Atom); 0.3 relevance threshold; Cerebras PR angle + inverted-pyramid press release; static journalist contacts per vertical slug + 3 wire services; Playwright pickup tracker; 6-hour scan cron + daily pickup cron.
**Approved:** Yes (all 4 trade-offs accepted)
**Do:** Installed `fast-xml-parser`; added `PrSignalStatus` enum, `PrSignal`, `PrPickup` models, `Vertical.news_rss_feeds`; seeded RSS feeds for Automotive + Healthcare; implemented `pr.service.ts`, `pr.controller.ts`, updated module; wrote smoke test.
**Check:** TypeScript clean (no backend errors); migration applied; Prisma client regenerated.
**Act:** Committed `3223b4e2`

### Cycle 6 — JWT fix + 401 proxy fix + push
**Plan:** Dashboard showing 401 on all API calls after backend restart — ephemeral JWT key pair reset on each restart invalidated browser sessions.
**Approved:** N/A (bug fix)
**Do:** Diagnosed key pair mismatch in .env (copy-paste corruption from prior session); wrote `scripts/fix-jwt-keys.js` — generates matched RS256-2048 pair atomically, self-verifies before writing to .env; confirmed round-trip sign/verify with .env keys passes; user restarted backend + logged in fresh.
**Check:** All analytics routes return 200; dashboard loads correctly.
**Act:** Committed `7f8e95da`; all Phase 8 commits pushed to `origin/main` HEAD `ec2a785d`.

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Aggregator crawler (Playwright) | DONE | c77bc177 | Completeness scoring |
| Aggregator profile update pack generator | DONE | c77bc177 | |
| Review platform monitors | DONE | 6e5d306d | Google Places API + verticals |
| Review request kit generator | DONE | 6e5d306d | WhatsApp/SMS/email/QR |
| Negative review detector + responder | DONE | 6e5d306d | |
| Community thread monitor | DONE | e814f582 | Reddit API or Playwright |
| Response draft generator | DONE | e814f582 | Cerebras llama3.1-8b |
| Wikidata entity checker | DONE | 5c19c6c7 | |
| Wikidata submission draft generator | DONE | 5c19c6c7 | |
| PR RSS monitor | DONE | 3223b4e2 | Vertical trusted domain feeds |
| Press release draft generator | DONE | 3223b4e2 | Inverted pyramid |
| 3 Fidelitus brand test run | PENDING | — | Waiting for Sir to provide 3 Fidelitus brand names for Beta onboarding — Phase 14 |
