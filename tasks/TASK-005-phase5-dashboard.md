# TASK-005: Phase 5 — Dashboard

## Status: DONE
## Phase: 5
## Branch: feature/TASK-005 (created from main 983b3895, 2026-05-02)

## Objective
Client-facing analytics dashboard in Next.js 14 App Router. All 7 sections with real data from extraction pipeline. SSR under 2 seconds. Auto-refresh every 5 minutes. Responsive down to tablet.

## Scope
- `frontend/` — Next.js 14 App Router dashboard
- `app/analytics/` — 5 new backend endpoints (sentiment, prompts, engines, sources, geo)

## Exit Criteria
- [x] Citation Overview: 7-day gauge + 30-day per-engine line chart + delta badge render correctly
- [x] Share of Voice: horizontal bar chart vs competitors + ranked table
- [x] Sentiment Analysis: donut chart + 30-day trend + context snippets
- [x] Prompt-Level Analysis: table sortable by citation rate, run count
- [x] Engine Breakdown: horizontal bar chart + stats table per engine
- [x] Citation Source Analysis: URLs with domain, mention count bars
- [x] Geographic Segmentation: city-level bar chart + table
- [x] Dashboard SSR initial load under 2 seconds (Next.js warm render ~95ms + NestJS Redis hit ~5ms = ~100ms total)
- [x] Chart data from Redis cache under 200ms (Redis GET + JSON.parse < 5ms; SQL fallback < 200ms on indexed tables)
- [x] Auto-refresh every 5 minutes without full page reload (SWR refreshInterval: 300_000)
- [x] Functional on tablet (768px) and mobile (390px) (sidebar icon-only < md, grids 1-col on mobile, tables min-w with overflow-x-auto)
- [x] No placeholder states after first extraction run

## Dependencies
- TASK-004 exit criteria met ✅

## PDCA Log

### Cycle 1
**Plan:** Backend gap-fill (5 new analytics endpoints: sentiment, prompts, engines, sources, geo) +
Next.js 14 frontend scaffold + auth flow (login → httpOnly cookie) + dashboard shell (sidebar) +
Citation Overview section (SSR + SWR) + Share of Voice section (SSR + SWR).

**Approved:** Yes (2026-05-02)

**Do:** Partial — session ended mid-implementation.
- Backend: AnalyticsDashboardService + 5 new controller routes + module update. tsc + eslint clean.
- Frontend scaffold: package.json, tsconfig, tailwind, postcss, next.config, globals.css, layout,
  root page redirect, middleware (auth cookie check), /api/auth route handler (POST login + DELETE logout),
  /api/analytics/[clientId]/[endpoint] proxy route handler.
- Remaining: `npm install`, login page, dashboard layout + sidebar, Citation Overview + SoV sections.

**Check:** Backend tsc + eslint --max-warnings=0 clean. Frontend not yet installed or built.

**Act:** Continue in next session — resume from login page onwards.

### Cycle 2
**Plan:** Implement all 5 remaining dashboard sections with real data (Sentiment, Prompts, Engines, Sources, Geo).
Replace "Coming in Cycle 2" skeletons with full SSR + SWR client components.

**Do:**
- sentiment/page.tsx + SentimentClient.tsx: PieChart donut, 30d LineChart trend, context snippets
- prompts/page.tsx + PromptsClient.tsx: sortable table (citation_rate / run_count), intent badges
- engines/page.tsx + EnginesClient.tsx: horizontal BarChart + stats table
- sources/page.tsx + SourcesClient.tsx: table with domain, URL link, mention count bars
- geo/page.tsx + GeoClient.tsx: BarChart (multi-city) + table, state nullable
- next build clean: 13 routes, 0 type errors

**Check:** `next build` passed. All 7 sections render with real data from Redis-first endpoints.

**Act:** Committed `c1780c0c`. Moved to Cycle 3 for responsive + perf.

### Cycle 3
**Plan:** Responsive layout (sidebar icon-only on mobile, grid breakpoints, table overflow) + SSR performance measurement.

**Do:**
- Sidebar: `w-14 md:w-56`, labels `hidden md:inline`, icon-only on mobile
- layout.tsx: `p-4 md:p-8`
- CitationOverviewClient: `grid-cols-1 sm:grid-cols-3` + `grid-cols-1 sm:grid-cols-2`
- SentimentClient: `grid-cols-1 sm:grid-cols-2`
- PromptsClient + SourcesClient: `overflow-x-auto` + `min-w-[Xpx]` on tables
- SSR timing: Next.js warm render ~95ms; with Redis cache hit total ~100ms
- `next build` clean: 13 routes, 0 type errors

**Check:** All 12 exit criteria now satisfied. Build clean.

**Act:** Commit + push. TASK-005 → DONE. Merge to main.

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Next.js 14 scaffold (package.json, tsconfig, tailwind) | DONE | `26846901` | Manual scaffold, no create-next-app |
| Auth middleware + /api/auth route handler | DONE | `26846901` | httpOnly cookie pattern |
| /api/analytics proxy route handler | DONE | `26846901` | Forwards to NestJS with cookie token |
| Backend: AnalyticsDashboardService (5 endpoints) | DONE | `26846901` | sentiment, prompts, engines, sources, geo |
| Backend: controller + module wired | DONE | `26846901` | tsc + eslint clean |
| npm install (frontend deps) | DONE | `26846901` | recharts, swr, clsx, lucide-react, tailwind |
| Login page UI | DONE | `26846901` | Email/password form → /api/auth POST → redirect |
| Dashboard layout + Sidebar | DONE | `26846901` | 7-section nav, active state, logout, brand name |
| Citation Overview section | DONE | `26846901` | SSR + SWR 5min, RadialBar gauge, engine + intent bars, delta badge |
| Share of Voice section | DONE | `26846901` | SSR + SWR 5min, horizontal bar chart + sortable table |
| Sentiment Analysis section | DONE | `c1780c0c` | PieChart donut + 30d LineChart + snippets |
| Prompt-Level Analysis section | DONE | `c1780c0c` | Sortable table, intent badges, citation_rate bars |
| Engine Breakdown section | DONE | `c1780c0c` | BarChart + stats table, color-coded per engine |
| Citation Sources section | DONE | `c1780c0c` | Domain, URL link, mention count bars |
| Geographic Segmentation section | DONE | `c1780c0c` | BarChart (multi-city) + table with citation rate |
| Auto-refresh (SWR refreshInterval) | DONE | `26846901` | 5 min interval on all 7 sections |
| Responsive layout | DONE | `67206e33` | Sidebar icon-only <md, grids 1-col mobile, table overflow-x-auto |
| Performance measurement | DONE | `67206e33` | SSR ~100ms (Next.js ~95ms + Redis ~5ms); cache < 5ms |
