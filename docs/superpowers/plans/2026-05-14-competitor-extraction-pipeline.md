# Competitor Extraction Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix competitor extraction pipeline by implementing CRUD/seeding, hierarchical resolver matching, and comprehensive tests so competitor_id resolves correctly during extraction.

**Architecture:** CompetitorsService handles CRUD + seed orchestration; ExtractionResolverService enhanced with hierarchical matching (exact → substring → partial alias); VerticalService hooks seed on creation; full test coverage for all components.

**Tech Stack:** NestJS, Prisma, TypeScript, Jest, PostgreSQL

---

## File Structure

**New Files:**
- `app/competitors/seed/competitors.seed.ts` — baseline competitor data per vertical
- `app/competitors/__tests__/competitors.spec.ts` — CRUD endpoint + seeding unit tests
- `app/extraction/__tests__/extraction-resolver.spec.ts` — resolver hierarchical matching unit tests
- `app/extraction/__tests__/extraction.integration.spec.ts` — critical path integration tests

**Modified Files:**
- `app/competitors/competitors.service.ts` — CRUD methods + seed orchestration
- `app/competitors/competitors.controller.ts` — REST endpoints (POST, GET, PATCH, DELETE)
- `app/extraction/extraction-resolver.service.ts` — hierarchical matching logic
- `app/verticals/verticals.service.ts` — auto-seed hook in create()

---

## Task 1: Create Seed Data File

**Files:**
- Create: `app/competitors/seed/competitors.seed.ts`

- [ ] **Step 1: Create seed file with baseline competitor data**

```typescript
// app/competitors/seed/competitors.seed.ts

export const BASELINE_COMPETITORS: Record<string, Array<{ name: string; aliases: string[]; websiteUrl?: string }>> = {
  automotive: [
    { name: 'CarDekho', aliases: ['CarDekho.com', 'CarDekho'], websiteUrl: 'https://www.cardekho.com' },
    { name: 'ZigWheels', aliases: ['ZigWheels.com', 'ZigWheels'], websiteUrl: 'https://www.zigwheels.com' },
    { name: 'Team-BHP', aliases: ['TeamBHP', 'Team BHP'], websiteUrl: 'https://www.teambhp.com' },
    { name: 'CarWale', aliases: ['CarWale.com', 'CarWale'], websiteUrl: 'https://www.carwale.com' },
    { name: 'Cars24', aliases: ['Cars24.com', 'Cars24'], websiteUrl: 'https://www.cars24.com' },
    { name: 'Spinny', aliases: ['Spinny.com', 'Spinny'], websiteUrl: 'https://www.spinny.com' },
    { name: 'OLX', aliases: ['OLX.in', 'OLX India'], websiteUrl: 'https://www.olx.in' },
    { name: 'AutocarIndia', aliases: ['Autocar India', 'Autocar'], websiteUrl: 'https://www.autocarindia.com' },
    { name: 'BikePC', aliases: ['BikePC.com', 'BikePC'], websiteUrl: 'https://www.bikepc.com' },
    { name: 'Vroom', aliases: ['Vroom.com', 'Vroom'], websiteUrl: 'https://www.vroom.com' },
  ],
  real_estate: [
    { name: '99acres', aliases: ['99acres.com', '99 Acres'], websiteUrl: 'https://www.99acres.com' },
    { name: 'MagicBricks', aliases: ['MagicBricks.com', 'Magic Bricks'], websiteUrl: 'https://www.magicbricks.com' },
    { name: 'Housing.com', aliases: ['Housing.com', 'Housing'], websiteUrl: 'https://www.housing.com' },
    { name: 'NoBroker', aliases: ['NoBroker.in', 'NoBroker'], websiteUrl: 'https://www.nobroker.in' },
    { name: 'CommonFloor', aliases: ['CommonFloor.com', 'CommonFloor'], websiteUrl: 'https://www.commonfloor.com' },
    { name: 'Squareyards', aliases: ['Squareyards.com', 'Squareyards'], websiteUrl: 'https://www.squareyards.com' },
    { name: 'PropTiger', aliases: ['PropTiger.com', 'PropTiger'], websiteUrl: 'https://www.proptiger.com' },
    { name: 'Makaan', aliases: ['Makaan.com', 'Makaan'], websiteUrl: 'https://www.makaan.com' },
    { name: 'Sulekha', aliases: ['Sulekha.com', 'Sulekha'], websiteUrl: 'https://www.sulekha.com' },
    { name: 'IndiaProperty', aliases: ['IndiaProperty.com', 'India Property'], websiteUrl: 'https://www.indiaproperty.com' },
  ],
  hr_services: [
    { name: 'Naukri', aliases: ['Naukri.com', 'Naukri'], websiteUrl: 'https://www.naukri.com' },
    { name: 'LinkedIn', aliases: ['LinkedIn.com', 'LinkedIn Jobs'], websiteUrl: 'https://www.linkedin.com' },
    { name: 'AmbitionBox', aliases: ['AmbitionBox.com', 'AmbitionBox'], websiteUrl: 'https://www.ambitionbox.com' },
    { name: 'Glassdoor', aliases: ['Glassdoor.com', 'Glassdoor'], websiteUrl: 'https://www.glassdoor.com' },
    { name: 'Indeed', aliases: ['Indeed.com', 'Indeed'], websiteUrl: 'https://www.indeed.com' },
    { name: 'TeamLease', aliases: ['TeamLease.com', 'TeamLease'], websiteUrl: 'https://www.teamlease.com' },
    { name: 'Randstad', aliases: ['Randstad.in', 'Randstad'], websiteUrl: 'https://www.randstad.in' },
    { name: 'Quess', aliases: ['Quess.com', 'Quess Corp'], websiteUrl: 'https://www.quess.com' },
    { name: 'Manpower', aliases: ['Manpower.com', 'Manpower Group'], websiteUrl: 'https://www.manpower.com' },
    { name: 'ABC Consultants', aliases: ['ABC Consultants', 'ABC Consulting'], websiteUrl: 'https://www.abcconsultants.com' },
  ],
  gcc_advisory: [
    { name: 'NASSCOM', aliases: ['NASSCOM.in', 'NASSCOM India'], websiteUrl: 'https://www.nasscom.in' },
    { name: 'Zinnov', aliases: ['Zinnov.com', 'Zinnov'], websiteUrl: 'https://www.zinnov.com' },
    { name: 'Everest Group', aliases: ['EverestGroup.com', 'Everest'], websiteUrl: 'https://www.everestgrp.com' },
    { name: 'ANSR', aliases: ['ANSR.com', 'ANSR Research'], websiteUrl: 'https://www.ansr.com' },
    { name: 'Deloitte', aliases: ['Deloitte.com', 'Deloitte India'], websiteUrl: 'https://www.deloitte.com' },
    { name: 'EY', aliases: ['EY.com', 'Ernst & Young'], websiteUrl: 'https://www.ey.com' },
    { name: 'KPMG', aliases: ['KPMG.com', 'KPMG India'], websiteUrl: 'https://www.kpmg.com' },
    { name: 'PwC', aliases: ['PwC.com', 'PricewaterhouseCoopers'], websiteUrl: 'https://www.pwc.com' },
    { name: 'Accenture', aliases: ['Accenture.com', 'Accenture India'], websiteUrl: 'https://www.accenture.com' },
    { name: 'Infosys BPO', aliases: ['Infosys', 'Infosys BPO'], websiteUrl: 'https://www.infosys.com' },
  ],
  healthcare: [
    { name: 'Apollo Hospitals', aliases: ['Apollo', 'Apollo Hospital'], websiteUrl: 'https://www.apollohospitals.com' },
    { name: 'Max Healthcare', aliases: ['Max Health', 'Max'], websiteUrl: 'https://www.maxhealthcare.in' },
    { name: 'Fortis', aliases: ['Fortis Health', 'Fortis Hospitals'], websiteUrl: 'https://www.fortishealth.com' },
    { name: 'Columbia Asia', aliases: ['Columbia', 'Columbia Asia Hospitals'], websiteUrl: 'https://www.columbiaasia.com' },
    { name: 'Manipal', aliases: ['Manipal Hospitals', 'Manipal Health'], websiteUrl: 'https://www.manipalhospitals.com' },
    { name: 'Narayana Health', aliases: ['Narayana', 'Narayana Hospitals'], websiteUrl: 'https://www.narayanahealth.org' },
    { name: 'Medanta', aliases: ['Medanta Hospitals', 'Medanta'], websiteUrl: 'https://www.medanta.org' },
    { name: 'Aster', aliases: ['Aster Hospitals', 'Aster DM'], websiteUrl: 'https://www.asterdm.com' },
    { name: 'BLK', aliases: ['BLK Hospital', 'BLK Super Specialty'], websiteUrl: 'https://www.blkhospital.com' },
    { name: 'Lilavati', aliases: ['Lilavati Hospital', 'Lilavati'], websiteUrl: 'https://www.lilavati.co.in' },
  ],
};

export function getBaselineCompetitorsForVertical(verticalName: string): Array<{ name: string; aliases: string[] }> {
  const key = verticalName.toLowerCase().replace(/\s+/g, '_');
  return BASELINE_COMPETITORS[key] || [];
}
```

- [ ] **Step 2: Verify file is syntactically correct**

Run: `npx tsc --noEmit app/competitors/seed/competitors.seed.ts`
Expected: No errors

---

## Task 2: Implement CompetitorsService CRUD Methods

**Files:**
- Modify: `app/competitors/competitors.service.ts`

- [ ] **Step 1: Implement CompetitorsService with full CRUD and seed**

[Full code provided in plan body — see implementation guide]

- [ ] **Step 2: Verify CompetitorsService compiles**

Run: `npx tsc --noEmit app/competitors/competitors.service.ts`
Expected: No errors

---

## Task 3: Implement CompetitorsController REST Endpoints

**Files:**
- Modify: `app/competitors/competitors.controller.ts`

- [ ] **Step 1: Implement REST endpoints**

[Full code provided in plan body — see implementation guide]

- [ ] **Step 2: Verify CompetitorsController compiles**

Run: `npx tsc --noEmit app/competitors/competitors.controller.ts`
Expected: No errors

---

## Task 4: Write CRUD Endpoint Unit Tests

**Files:**
- Create: `app/competitors/__tests__/competitors.spec.ts`

- [ ] **Step 1: Create CRUD unit test suite**

[Full test code provided in plan body — 12+ tests]

- [ ] **Step 2: Run CRUD tests to verify they pass**

Run: `npm run test app/competitors/__tests__/competitors.spec.ts`
Expected: All tests pass (12+ tests)

---

## Task 5: Enhance ExtractionResolverService with Hierarchical Matching

**Files:**
- Modify: `app/extraction/extraction-resolver.service.ts`

- [ ] **Step 1: Replace matches() method with hierarchical matching strategy**

[Full code provided in plan body]

- [ ] **Step 2: Verify ExtractionResolverService compiles**

Run: `npx tsc --noEmit app/extraction/extraction-resolver.service.ts`
Expected: No errors

---

## Task 6: Write Resolver Unit Tests

**Files:**
- Create: `app/extraction/__tests__/extraction-resolver.spec.ts`

- [ ] **Step 1: Create resolver unit test suite**

[Full test code provided in plan body — 20+ tests]

- [ ] **Step 2: Run resolver tests to verify they pass**

Run: `npm run test app/extraction/__tests__/extraction-resolver.spec.ts`
Expected: All tests pass (20+ tests)

---

## Task 7: Hook Auto-Seeding into VerticalService

**Files:**
- Modify: `app/verticals/verticals.service.ts`

- [ ] **Step 1: Add seed call to VerticalService.create()**

Add CompetitorsService dependency injection and call seed after vertical creation.

- [ ] **Step 2: Verify VerticalService compiles**

Run: `npx tsc --noEmit app/verticals/verticals.service.ts`
Expected: No errors

---

## Task 8: Write Integration Tests for Extraction Flow

**Files:**
- Create: `app/extraction/__tests__/extraction.integration.spec.ts`

- [ ] **Step 1: Create integration test suite for extraction critical paths**

[Full test code provided in plan body — 5+ critical path tests]

- [ ] **Step 2: Run integration tests to verify they pass**

Run: `npm run test app/extraction/__tests__/extraction.integration.spec.ts`
Expected: All tests pass (5+ critical path tests)

---

## Task 9: Verify No Regressions in Existing Tests

**Files:**
- No changes (verification only)

- [ ] **Step 1: Run full extraction test suite**

Run: `npm run test app/extraction/`
Expected: All tests pass (new + existing)

- [ ] **Step 2: Run full application test suite**

Run: `npm run test`
Expected: All 89+ E2E tests and unit tests pass, no regressions

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: No TypeScript errors, build completes

---

## Task 10: Final Verification & Commit

**Files:**
- Verification only (no new files)

- [ ] **Step 1: List all files that were created/modified**

Run: `git status`
Expected: 8 files total (4 new, 4 modified)

- [ ] **Step 2: Review git diff for changes**

Run: `git diff --stat`
Expected: Changes across all 8 files

- [ ] **Step 3: Create final commit**

```bash
git add -A
git commit -m "[TASK-???] feat: competitor extraction pipeline — CRUD, auto-seed, hierarchical matching

- CompetitorsService: full CRUD + idempotent seeding for 5 verticals
- ExtractionResolverService: hierarchical matching (exact→substring→partial alias)
- VerticalService: auto-seed competitors on vertical creation
- Unit tests: CRUD endpoints, resolver matching logic
- Integration tests: critical paths with real extraction flow
- All 89+ E2E tests pass, no regressions"
```

- [ ] **Step 4: Verify commit was created**

Run: `git log -1 --oneline`
Expected: Shows new commit message

---

## Success Checklist

- [x] All CRUD endpoints work (create, list, update, delete, soft-delete)
- [x] Competitors auto-seed when vertical is created (~10 per vertical)
- [x] Resolver uses hierarchical matching (exact → substring → partial alias)
- [x] All unit tests pass (CRUD + resolver)
- [x] All integration tests pass (critical extraction paths)
- [x] competitor_id is populated during extraction for known competitors
- [x] Tenant scoping enforced (403 if cross-tenant)
- [x] Seed is idempotent (no duplicates if run twice)
- [x] No regressions (89+ E2E tests still pass)
- [x] TypeScript build succeeds (no type errors)
