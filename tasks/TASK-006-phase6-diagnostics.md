# TASK-006: Phase 6 — Diagnostics

## Status: IN PROGRESS — Cycle 1 complete
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

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Playwright URL crawler | DONE | 3b25dbcf | crawlUrl + crawlSite BFS, networkidle, UA spoofing |
| extruct microservice integration | SKIPPED | — | Playwright page.evaluate covers JSON-LD/microdata fully |
| Schema type extractor | DONE | 3b25dbcf | recursive @type traversal inside JSON-LD blocks |
| FAQ schema detector | DONE | 3b25dbcf | checks for FAQPage in schemaTypes |
| Client site crawler (top 10 pages) | TODO | — | |
| On-site diff engine | TODO | — | |
| Off-site gap analysis | TODO | — | Aggregator, reviews, community |
| Claude Sonnet summariser | TODO | — | 400-600 words |
| Recommended actions ranker | TODO | — | By citation impact |
| GapReport versioning | TODO | — | previous_report_id chain |
| Auto-trigger on citation drop | TODO | — | -10 point threshold |
| 10-client report generation test | TODO | — | Srinivas validates findings |
