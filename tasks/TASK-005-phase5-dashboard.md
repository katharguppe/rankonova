# TASK-005: Phase 5 — Dashboard

## Status: IN PROGRESS
## Phase: 5
## Branch: feature/TASK-005 (created from main 983b3895, 2026-05-02)

## Objective
Client-facing analytics dashboard in Next.js 14 App Router. All 7 sections with real data from extraction pipeline. SSR under 2 seconds. Auto-refresh every 5 minutes. Responsive down to tablet.

## Scope
- `frontend/` — Next.js 14 App Router dashboard
- `app/analytics/` — 5 new backend endpoints (sentiment, prompts, engines, sources, geo)

## Exit Criteria
- [ ] Citation Overview: 7-day gauge + 30-day per-engine line chart + delta badge render correctly
- [ ] Share of Voice: stacked bar vs top 5 competitors, filterable by intent and engine
- [ ] Sentiment Analysis: donut chart + 30-day trend + context snippets
- [ ] Prompt-Level Analysis: table sortable by citation rate, engine breakdown columns
- [ ] Engine Breakdown: side-by-side citation rate per engine
- [ ] Citation Source Analysis: URLs competitors get cited for, schema types found
- [ ] Geographic Segmentation: city-level breakdown for multi-city clients
- [ ] Dashboard SSR initial load under 2 seconds (measured, not estimated)
- [ ] Chart data from Redis cache under 200ms
- [ ] Auto-refresh every 5 minutes without full page reload
- [ ] Functional on tablet (768px) and mobile (390px)
- [ ] No placeholder states after first extraction run

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

## Checkpoints
| Step | Status | Git Commit | Notes |
|------|--------|------------|-------|
| Next.js 14 scaffold (package.json, tsconfig, tailwind) | DONE | `pending` | Manual scaffold, no create-next-app |
| Auth middleware + /api/auth route handler | DONE | `pending` | httpOnly cookie pattern |
| /api/analytics proxy route handler | DONE | `pending` | Forwards to NestJS with cookie token |
| Backend: AnalyticsDashboardService (5 endpoints) | DONE | `pending` | sentiment, prompts, engines, sources, geo |
| Backend: controller + module wired | DONE | `pending` | tsc + eslint clean |
| npm install (frontend deps) | TODO | — | recharts, swr, clsx, lucide-react, tailwind |
| Login page UI | TODO | — | Email/password form → /api/auth POST |
| Dashboard layout + Sidebar | TODO | — | 7-section nav, client ID from URL |
| Citation Overview section | TODO | — | SSR + SWR, RadialBar gauge + engine bars |
| Share of Voice section | TODO | — | SSR + SWR, horizontal bar chart |
| Remaining 5 sections (skeleton) | TODO | — | Sentiment, Prompts, Engines, Sources, Geo |
| Auto-refresh (SWR refreshInterval) | TODO | — | 5 min interval |
| Responsive layout | TODO | — | Tablet + mobile tested |
| Performance measurement | TODO | — | SSR < 2s, chart < 200ms |
