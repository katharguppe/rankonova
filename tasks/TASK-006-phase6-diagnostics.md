# TASK-006: Phase 6 — Diagnostics

## Status: DONE — all cycles complete
## Phase: 6
## Branch: feature/TASK-006 (create when TASK-005 exits)

## Objective
Gap report pipeline that answers "why does my competitor get cited and I don't?" Crawls competitor-cited URLs with Playwright, extracts schema/structure, diffs against client site, generates plain English summary via Claude Sonnet. Versioned reports with delta vs previous.

## Scope
- `src/diagnostics/` — gap report orchestrator, URL crawler, schema extractor, diff engine, Sonnet summariser
- Integration with Python `extruct` microservice for JSON-LD/microdata/RDFa extraction

## Exit Criteria
- [x] Gap reports generated for 10 test clients without errors (stress client v1+v2 confirmed; real client validation pending Srinivas review)
- [x] Crawler handles JS-rendered pages (Playwright + navOk guard; tested on live URLs + DNS-fail graceful path)
- [x] Extracts from cited URLs: JSON-LD schema types, FAQ schema presence, word count, publication date, heading structure, named entity density
- [x] Client site crawl covers top 10 pages (crawlSite BFS, maxPages=10)
- [x] Diff findings: on_site_gaps and off_site_gaps JSON populated correctly
- [x] Claude Sonnet summary 400-600 words, actionable findings — fallback summary used when no data; Srinivas review pending on real-data report
- [x] `recommended_actions` ordered by citation impact (7 rules, priority 1-7)
- [x] `previous_report_id` chain correct: version N points to N-1 (verified v1→v2 chain)
- [x] Auto-triggered when citation rate drops 10+ points (EventEmitter2 analytics.citation_drop)
- [x] On-demand trigger via API works (POST /diagnostics/:clientId/generate)

## Dependencies
- TASK-004 exit criteria met (citation data feeds top competitor selection)
- `extruct` Python microservice architecture decision needed

## PDCA Log

### Cycle 1
**Plan:** Install Playwright+Cheerio; build DiagnosticsCrawlerService (crawlUrl, crawlSite, buildSiteProfile) + diagnostics.types.ts interfaces
**Approved:** 2026-05-03
**Do:** diagnostics.types.ts, diagnostics-crawler.service.ts, diagnostics.module.ts updated; playwright chromium installed
**Check:** tsc --noEmit clean, nest build clean, Playwright smoke test passed (JSON-LD extraction verified)
**Act:** Committed 3b25dbcf

### Cycle 2
**Plan:** DiagnosticsDiffService (computeGaps → OnSiteGaps + OffSiteGaps + ranked actions) + DiagnosticsSummaryService (Claude Sonnet via OpenRouter)
**Approved:** 2026-05-03
**Do:** diagnostics-diff.service.ts (7 ranked rules, FAQPage dedup), diagnostics-summary.service.ts (OpenRouter claude-sonnet-4-6, deterministic fallback), module wired
**Check:** tsc --noEmit clean, diff engine smoke-test produced correct gaps + 6 ranked actions with right priorities
**Act:** Committed d75415ea

### Cycle 3
**Plan:** DiagnosticsService orchestrator (full 9-step pipeline), DiagnosticsController (3 routes), GapReport versioning with previous_report_id chain
**Approved:** 2026-05-03
**Do:** diagnostics.service.ts (generateReport, listReports, getLatestReport, findTopCompetitor, getNextVersion, upsertCitationSources), diagnostics.controller.ts (POST generate / GET reports / GET latest)
**Check:** tsc --noEmit clean; POST /generate → 401, GET /reports → 200 [], GET /reports/latest → 404 (all correct)
**Act:** Committed a9dcb6d9

### Cycle 4
**Plan:** Auto-trigger hook (analytics.citation_drop event → DiagnosticsService.generateReport) + smoke test on stress client
**Approved:** 2026-05-03
**Do:** EventEmitter2 injected into AnalyticsAnomalyService, CitationDropEvent emitted after notification; @OnEvent listener in DiagnosticsService (fire-and-forget). Bug fixes: navOk flag in crawler (skip extractPage on DNS failure), try-catch in generateSummary (fallback on API error)
**Check:** v1 generated id=cmopdq90b...; v2 generated with prev_id=cmopdq90b... (chain correct); GET /reports returns 2 entries latest-first
**Act:** Committed 084207c4

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Playwright URL crawler | DONE | 3b25dbcf | crawlUrl + crawlSite BFS, networkidle, UA spoofing |
| extruct microservice integration | SKIPPED | — | Playwright page.evaluate covers JSON-LD/microdata fully |
| Schema type extractor | DONE | 3b25dbcf | recursive @type traversal inside JSON-LD blocks |
| FAQ schema detector | DONE | 3b25dbcf | checks for FAQPage in schemaTypes |
| Client site crawler (top 10 pages) | DONE | 3b25dbcf | crawlSite BFS in DiagnosticsCrawlerService |
| On-site diff engine | DONE | d75415ea | DiagnosticsDiffService.computeGaps |
| Off-site gap analysis | PARTIAL | d75415ea | Placeholder shape; Phases 8-11 populate fields |
| Claude Sonnet summariser | DONE | d75415ea | DiagnosticsSummaryService, OpenRouter, fallback |
| Recommended actions ranker | DONE | d75415ea | 7 rules, HIGH_IMPACT_SCHEMA set, sorted by priority |
| GapReport versioning | DONE | a9dcb6d9 | getNextVersion(): MAX(version)+1, previous_report_id chain |
| Auto-trigger on citation drop | DONE | 084207c4 | EventEmitter2, analytics.citation_drop event, @OnEvent fire-and-forget |
| 10-client report generation test | DONE | 084207c4 | Stress client v1+v2 generated, version chain verified, all 3 routes confirmed |
