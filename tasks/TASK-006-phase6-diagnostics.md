# TASK-006: Phase 6 — Diagnostics

## Status: IN PROGRESS — Cycle 3 complete
## Phase: 6
## Branch: feature/TASK-006 (create when TASK-005 exits)

## Objective
Gap report pipeline that answers "why does my competitor get cited and I don't?" Crawls competitor-cited URLs with Playwright, extracts schema/structure, diffs against client site, generates plain English summary via Claude Sonnet. Versioned reports with delta vs previous.

## Scope
- `src/diagnostics/` — gap report orchestrator, URL crawler, schema extractor, diff engine, Sonnet summariser
- Integration with Python `extruct` microservice for JSON-LD/microdata/RDFa extraction

## Exit Criteria
- [ ] Gap reports generated for 10 test clients without errors
- [ ] Crawler handles JS-rendered pages (Playwright verified vs static HTML)
- [ ] Extracts from cited URLs: JSON-LD schema types, FAQ schema presence, word count, publication date, heading structure, named entity density
- [ ] Client site crawl covers top 10 pages
- [ ] Diff findings: on_site_gaps and off_site_gaps JSON populated correctly
- [ ] Claude Sonnet summary 400-600 words, actionable findings (Srinivas review)
- [ ] `recommended_actions` ordered by citation impact
- [ ] `previous_report_id` chain correct: version N points to N-1
- [ ] Auto-triggered when citation rate drops 10+ points
- [ ] On-demand trigger via API works

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
| Auto-trigger on citation drop | TODO | — | -10 point threshold |
| 10-client report generation test | TODO | — | Srinivas validates findings |
