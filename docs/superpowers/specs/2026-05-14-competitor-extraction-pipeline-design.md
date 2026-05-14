# Competitor Extraction Pipeline Fix — Design Doc
**Date:** 2026-05-14  
**Task:** Fix competitor extraction blockers (no population, strict matching, no competitor_id resolution)  
**Approach:** Pragmatic Middle (Approach C)

---

## Executive Summary

The competitor extraction pipeline has three blockers:
1. **Competitors table is never populated** — no CRUD endpoints, no seeding
2. **Extraction resolver uses strict exact-match only** — misses conversational mentions ("Nike" vs "Nike shoes")
3. **competitor_id never resolves** — because of strict matching + lack of baseline data

**Solution:** Implement hybrid competitor seeding (auto-seed baseline ~10 per vertical + manual CRUD), enhance resolver with hierarchical matching (exact → substring → partial alias), and add comprehensive tests. Architecture mirrors existing patterns (prompts auto-seed with verticals).

---

## Architecture

### Services

**CompetitorsService** (`app/competitors/competitors.service.ts`)
- CRUD operations: create, list, update, delete
- Seed orchestration: called from VerticalService.create()
- Tenant-scoped all queries
- Methods:
  - `create(tenantId, verticalId, name, aliases?, websiteUrl?): Promise<Competitor>`
  - `list(tenantId, verticalId?, isActive?): Promise<Competitor[]>`
  - `update(id, tenantId, patch): Promise<Competitor>`
  - `delete(id, tenantId): Promise<void>` (soft-delete via is_active=false)
  - `seed(tenantId, verticalId): Promise<Competitor[]>` (insert baseline competitors)
  - `countByVertical(tenantId, verticalId): Promise<number>`

**ExtractionResolverService** (`app/extraction/extraction-resolver.service.ts`)
- Enhanced `matches()` method with hierarchical strategy
- Logs which matching strategy succeeded (for debugging)
- No breaking changes to existing interface

**VerticalService Hook**
- After vertical creation, call `competitorsService.seed(tenantId, verticalId)`
- Idempotent: skip if competitors already exist for that (tenant, vertical) pair

---

## Data & Seeding

### Baseline Competitor Data

5 verticals with 10 competitors each (exact):

**Automotive**
- CarDekho, ZigWheels, Team-BHP, CarWale, Cars24, Spinny, OLX, AutocarIndia, BikePC, Vroom

**Real Estate**
- 99acres, MagicBricks, Housing.com, NoBroker, CommonFloor, Squareyards, PropTiger, Makaan, Sulekha, IndiaProperty

**HR Services**
- Naukri, LinkedIn, AmbitionBox, Glassdoor, Indeed, TeamLease, Randstad, Quess, Manpower, ABC Consultants

**GCC Advisory**
- NASSCOM, Zinnov, Everest Group, ANSR, Deloitte, EY, KPMG, PwC, Accenture, Infosys BPO

**Healthcare**
- Apollo Hospitals, Max Healthcare, Fortis, Columbia Asia, Manipal, Narayana Health, Medanta, Aster, BLK, Lilavati

### Seed File

`app/competitors/seed/competitors.seed.ts` — export const BASELINE_COMPETITORS: Record<string, string[]>

### Seed Trigger & Idempotency

- Called from `VerticalService.create()` after vertical record is inserted
- Idempotent check: `if (count >= 10) return []` (skip if already seeded)
- Partial failure: if 1 competitor fails to insert, log error and continue (don't fail entire seed)
- No return value required; seed runs fire-and-forget after vertical creation

---

## Resolver: Hierarchical Matching

### Strategy (per brand mention)

```
1. EXACT MATCH
   - brand === competitor.name (case-insensitive trim)
   - OR brand in competitor.aliases (case-insensitive)
   → return competitor.id

2. SUBSTRING MATCH
   - brand is substring of competitor.name (case-insensitive)
   - OR brand is substring of any alias
   → return competitor.id

3. PARTIAL ALIAS MATCH
   - any word in brand matches start of any alias
   - e.g., "Nike shoes" → "Nike" matches alias starting with "Nike"
   → return competitor.id

4. NO MATCH
   → return null
```

### Client Brand Precedence

- Check client brand first; if match, return `{ is_client_brand: true, competitor_id: null }` immediately
- Only check competitors if not a client brand

### Logging

- Info: `matched via [exact|substring|alias] for brand "${brand}" → competitor "${name}"`
- No logs for no-match (too noisy)

### Changes to ExtractionResolverService

- Enhance `private matches()` method to support multiple strategies
- Add `private matchExact()`, `private matchSubstring()`, `private matchPartialAlias()` helpers
- Modify `resolve()` to try strategies in order, return on first match

---

## REST Endpoints

### Competitors Controller

**POST /competitors**
- Body: `{ verticalId: string, name: string, aliases?: string[], websiteUrl?: string }`
- Returns: created Competitor
- Scoped to authenticated tenant
- Validation: verticalId must exist for tenant, max 10 per vertical (soft limit, warn at 9)

**GET /competitors**
- Query: `verticalId?: string, isActive?: boolean`
- Returns: Competitor[]
- Scoped to authenticated tenant
- Defaults: all verticals, isActive=true only

**PATCH /competitors/:id**
- Body: `{ name?: string, aliases?: string[], websiteUrl?: string, isActive?: boolean }`
- Returns: updated Competitor
- Scoped to authenticated tenant (verify ownership)

**DELETE /competitors/:id**
- No body
- Soft-delete (is_active = false)
- Scoped to authenticated tenant

---

## Error Handling & Validation

### CRUD Layer

- **Tenant scoping:** all operations validate tenantId matches authenticated user's tenant; return 403 if mismatch
- **Vertical existence:** competitor creation requires valid verticalId for that tenant (404 if not)
- **Max competitors per vertical:** soft limit 10; warn at 9, allow override for admin
- **Duplicate names:** prevent duplicate competitor names per (tenant, vertical) pair (409 Conflict)
- **Alias validation:** aliases must be non-empty strings in JSON array; reject nulls or empty strings
- **Required fields:** name is required; aliases and websiteUrl are optional

### Seeding Edge Cases

- **Idempotency:** if seed called twice, check count >= 10 and skip (no-op)
- **Partial failure:** if seeding 1 competitor fails, log error and continue with rest
- **Missing vertical:** if vertical doesn't exist (shouldn't happen from hook, but catch anyway), log error and return empty array

### Extraction Flow

- **Null competitors list:** if no competitors exist for tenant, resolver still returns valid `{ is_client_brand: boolean, competitor_id: null }`
- **Empty aliases:** if competitor.aliases is null/empty array, resolver skips alias matching steps gracefully
- **Circular client/competitor:** if client brand name exactly matches competitor name, client brand takes precedence

### Logging Levels

- **Info:** competitor created/updated/deleted, seed completed successfully, resolver matched via strategy
- **Warn:** max competitors hit, duplicate name attempt, partial seed failure, resolver no-match
- **Error:** CRUD permission denied, vertical not found, seed crash

---

## Testing Strategy

### Unit Tests: CRUD (`app/competitors/__tests__/competitors.spec.ts`)

```
✓ create competitor with name + aliases
✓ create competitor validates tenant_id scoping (403 if cross-tenant)
✓ create competitor requires valid verticalId (404 if not found)
✓ create competitor prevents duplicates per (tenant, vertical) (409)
✓ list competitors for vertical (filtered by tenant + vertical)
✓ list competitors with isActive=true filter
✓ update competitor (name, aliases, websiteUrl)
✓ update competitor validates ownership (403 if cross-tenant)
✓ delete competitor (soft-delete, is_active=false)
✓ delete competitor prevents cross-tenant access (403)
✓ seed baseline competitors for vertical
✓ seed is idempotent (skip if count >= 10)
✓ seed populates aliases correctly from seed data
```

### Unit Tests: Resolver (`app/extraction/__tests__/extraction-resolver.spec.ts`)

```
Exact Match:
✓ "Nike" matches competitor with name="Nike"
✓ "adidas shoes" (brand normalized) matches competitor with name="Adidas"
✓ "Puma" matches if in competitor.aliases
✓ case-insensitive matching

Substring Match:
✓ "Nike Air" contains "Nike" (substring of name)
✓ "Adidas Boost" contains "Adidas" (substring of alias)

Partial Alias Match:
✓ "Nike shoes" → "Nike" matches alias starting with "Nike"
✓ "Team-BHP forum" → "Team-BHP" matches alias prefix

No Match:
✓ "UnknownBrand" returns null
✓ "random mention" returns null

Precedence:
✓ client brand returns is_client_brand=true regardless of competitor matches
✓ exact match takes priority over substring
```

### Integration Tests: Extraction Flow (`app/extraction/__tests__/extraction.integration.spec.ts`)

```
Critical Paths:
✓ end-to-end: create competitor → run extraction → verify competitor_id populated (exact match)
✓ end-to-end with aliases: create competitor with aliases → extraction matches via alias → competitor_id set
✓ conversational mention: "Nokia competitor" → no match → competitor_id null, is_client_brand false
✓ client brand precedence: "Nike" (client brand) → is_client_brand true even if Nike is competitor

Setup/Teardown:
- beforeAll: create tenant, vertical, client, competitors
- afterAll: delete all records (maintains existing E2E cleanup pattern)
```

---

## Files to Create/Modify

### New Files

- `app/competitors/seed/competitors.seed.ts` — baseline competitor data per vertical
- `app/competitors/__tests__/competitors.spec.ts` — CRUD unit tests
- `app/extraction/__tests__/extraction-resolver.spec.ts` — resolver unit tests
- `app/extraction/__tests__/extraction.integration.spec.ts` — critical path integration tests (or extend existing extraction.spec.ts)
- `docs/superpowers/specs/2026-05-14-competitor-extraction-pipeline-design.md` — this file

### Modified Files

- `app/competitors/competitors.service.ts` — implement CRUD + seed methods
- `app/competitors/competitors.controller.ts` — implement REST endpoints (POST, GET, PATCH, DELETE)
- `app/extraction/extraction-resolver.service.ts` — enhance matches() with hierarchical strategy
- `app/verticals/verticals.service.ts` — add seed hook in create() method

---

## Backward Compatibility

✅ **Fully backward-compatible.** No breaking changes:
- Existing extraction flow unchanged (ExtractionService, ExtractionHaikuService)
- Resolver return type unchanged (ResolvedMention interface)
- No DB schema changes (Competitor model already exists)
- Extraction still works with no competitors (resolver returns competitor_id=null gracefully)

---

## Success Criteria

- [ ] CRUD endpoints work end-to-end (create, list, update, delete)
- [ ] Competitors auto-seed when vertical is created (~10 per vertical)
- [ ] Resolver uses hierarchical matching (exact → substring → partial alias)
- [ ] All CRUD tests pass (create, list, update, delete, seeding)
- [ ] All resolver unit tests pass (exact, substring, alias, no-match)
- [ ] All integration tests pass (critical paths with real extraction flow)
- [ ] competitor_id is populated during extraction for known competitors
- [ ] Tenant scoping enforced on all endpoints (403 if cross-tenant)
- [ ] Seed is idempotent (no duplicates if run twice)
- [ ] No regressions in existing extraction tests (89/89 E2E tests still pass)

---

## Timeline

- Implementation: write CRUD service, resolver enhancement, seed file
- Testing: write unit + integration tests, verify all pass
- Integration: hook seed into VerticalService, verify extraction flow end-to-end
- Verification: run full test suite, check no regressions

---

## Notes

- Max 10 competitors per vertical per tenant (enforced in CRUD, soft limit with warn at 9)
- Aliases stored as JSON array in DB (existing schema supports this)
- Seed data is static (hard-coded per vertical); no external API calls
- Partial failure in seed doesn't fail entire pipeline (continue on error)
- No changes to Extraction service or Controller; resolver is the only touch point
