# TASK-005: Phase 5 — Dashboard

## Status: PLANNING
## Phase: 5
## Branch: feature/TASK-005 (create when TASK-004 exits)

## Objective
Client-facing analytics dashboard in Next.js 14 App Router. All 7 sections with real data from extraction pipeline. SSR under 2 seconds. Auto-refresh every 5 minutes. Responsive down to tablet.

## Scope
- `frontend/app/dashboard/` — all dashboard sections, SSR pages
- `frontend/components/` — chart components (Recharts), shared UI (shadcn/ui)
- `frontend/lib/` — type-safe API client (openapi-typescript generated)

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
- TASK-004 exit criteria met

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
| Next.js 14 App Router setup | TODO | — | Inside monorepo or separate |
| OpenAPI spec generation from NestJS | TODO | — | Swagger → openapi.json |
| openapi-typescript client generation | TODO | — | Typed fetch wrapper |
| Citation Overview section | TODO | — | |
| Share of Voice section | TODO | — | |
| Sentiment Analysis section | TODO | — | |
| Prompt-Level Analysis section | TODO | — | |
| Engine Breakdown section | TODO | — | |
| Citation Source Analysis section | TODO | — | |
| Geographic Segmentation section | TODO | — | |
| Auto-refresh (SWR or polling) | TODO | — | 5 min interval |
| Responsive layout | TODO | — | Tablet + mobile tested |
| Performance measurement | TODO | — | SSR < 2s, chart < 200ms |
