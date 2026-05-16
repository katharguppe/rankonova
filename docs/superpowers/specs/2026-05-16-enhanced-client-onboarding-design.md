# TASK-012: Enhanced Client Onboarding Design
**Date:** 2026-05-16  
**Status:** Design Approved  
**Scope:** Extend Client entity with brand profile fields; add profile update API  

---

## 1. Overview

Extend the Client entity with 4 optional fields to capture brand profile information during and after client onboarding:
- Digital social media handles (LinkedIn, Twitter, Instagram, YouTube, secondary website)
- Brand description (USP, target audience, positioning)
- Brand keywords (top keywords client wants to rank for)
- Manually entered known competitors (user-curated list to seed competitor tracking)

These fields enable richer brand context for the AEO platform while maintaining backward compatibility (all fields nullable, no breaking migrations).

---

## 2. Requirements

### 2.1 Functional
1. **Data Storage:** Add 4 new columns to Client entity; all optional (nullable)
2. **API Endpoint:** New `PATCH /clients/:id/profile` endpoint for profile updates
3. **Validation:** Backend validation on all input fields (format, length, array bounds)
4. **Frontend:** Extend onboarding form + add profile edit UI
5. **Backward Compatibility:** Existing clients work unchanged; new fields default to null
6. **Testing:** All 204 existing jest tests pass; 6 new tests added

### 2.2 Non-Functional
- **Type Safety:** Full TypeScript support; class-validator decorators on all fields
- **Authorization:** Tenant-scoped; RolesGuard applied (super_admin, tenant_admin, client_manager)
- **Performance:** No index changes; schema migrations additive only
- **Migration Path:** Single Prisma migration, no data backfill needed

---

## 3. Data Model

### 3.1 New Client Fields

```typescript
// prisma/schema/schema.prisma - Client model additions

model Client {
  // ... existing fields ...
  
  // NEW FIELDS (all optional)
  digital_handles   Json?         // { linkedin?, twitter?, instagram?, youtube?, website_secondary? }
  brand_description String?       // Max 500 chars; what brand does, USP, target audience
  brand_keywords    Json?         // String[]; max 20 items, each 2-100 chars
  competitors_known Json?         // String[]; max 20 items (manually entered), each 2-100 chars
  
  // ... existing relations ...
}
```

### 3.2 Type Definitions

**digital_handles object shape:**
```typescript
{
  linkedin?: string          // Optional, URL or handle format
  twitter?: string           // Optional
  instagram?: string         // Optional
  youtube?: string           // Optional, URL or channel ID
  website_secondary?: string // Optional, full URL
}
```

**brand_keywords & competitors_known:**
- Both are `string[]` arrays
- Max 20 items per array
- Each item: 2-100 characters
- No duplicates enforced at API level (frontend can dedupe)

---

## 4. API Design

### 4.1 New Endpoint: PATCH /clients/:id/profile

**Path:** `PATCH /api/clients/:id/profile`  
**Guards:** JwtAuthGuard, RolesGuard  
**Roles:** super_admin, tenant_admin, client_manager  
**Scope:** Tenant-scoped (req.user.tenantId must match client's tenant_id)

**Request Body (UpdateClientProfileDto):**
```typescript
{
  digital_handles?: {
    linkedin?: string
    twitter?: string
    instagram?: string
    youtube?: string
    website_secondary?: string
  }
  brand_description?: string    // Max 500 chars
  brand_keywords?: string[]     // Max 20 items
  competitors_known?: string[]  // Max 20 items
}
```

**Response (200 OK):**
```typescript
{
  id: string
  tenant_id: string
  vertical_id: string
  name: string
  brand_name: string
  city: string
  state: string
  website_url: string
  description: string | null
  aliases: string[]
  models: object
  is_active: boolean
  digital_handles: object | null
  brand_description: string | null
  brand_keywords: string[] | null
  competitors_known: string[] | null
  created_at: string
  updated_at: string
}
```

**Error Responses:**
- 400 Bad Request: Validation failure (invalid format, exceeds length, array too large)
- 401 Unauthorized: No JWT or expired
- 403 Forbidden: Insufficient role or wrong tenant
- 404 Not Found: Client does not exist

---

## 5. Backend Implementation

### 5.1 DTOs (app/clients/dto/)

**UpdateClientProfileDto:**
```typescript
import { IsObject, IsOptional, IsString, MaxLength, IsArray, 
         ArrayMaxSize, MinLength, MaxLength, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

class DigitalHandlesDto {
  @IsOptional()
  @IsString()
  linkedin?: string;

  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  youtube?: string;

  @IsOptional()
  @IsString()
  website_secondary?: string;
}

export class UpdateClientProfileDto {
  @IsOptional()
  @Type(() => DigitalHandlesDto)
  @ValidateNested()
  digital_handles?: DigitalHandlesDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brand_description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(100, { each: true })
  brand_keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(100, { each: true })
  competitors_known?: string[];
}
```

### 5.2 Service Method (app/clients/clients.service.ts)

**New method: updateClientProfile**
```typescript
async updateClientProfile(
  clientId: string,
  tenantId: string,
  profileData: UpdateClientProfileDto,
): Promise<Client> {
  // Verify client exists and belongs to tenant
  const client = await this.prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, deleted_at: null },
  });
  
  if (!client) throw new NotFoundException('Client not found');

  // Update only the profile fields (ignore other fields if maliciously passed)
  return this.prisma.client.update({
    where: { id: clientId },
    data: {
      digital_handles: profileData.digital_handles || undefined,
      brand_description: profileData.brand_description || undefined,
      brand_keywords: profileData.brand_keywords || undefined,
      competitors_known: profileData.competitors_known || undefined,
      updated_at: new Date(),
    },
    select: {
      id: true,
      tenant_id: true,
      vertical_id: true,
      name: true,
      brand_name: true,
      city: true,
      state: true,
      website_url: true,
      description: true,
      aliases: true,
      models: true,
      is_active: true,
      digital_handles: true,
      brand_description: true,
      brand_keywords: true,
      competitors_known: true,
      created_at: true,
      updated_at: true,
    },
  });
}
```

### 5.3 Controller Endpoint (app/clients/clients.controller.ts)

**New method: updateProfile**
```typescript
@Patch(':id/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
async updateProfile(
  @Param('id') id: string,
  @Body() dto: UpdateClientProfileDto,
  @Req() req: Request,
): Promise<Client> {
  const user = req.user as RequestUser;
  return this.clientsService.updateClientProfile(id, user.tenantId, dto);
}
```

---

## 6. Frontend Implementation

### 6.1 Extend New Client Form
- Add collapsible "Brand Profile (Optional)" section to `/dashboard/new-client/page.tsx`
- Fields:
  - Digital handles inputs (5 separate text fields)
  - Brand description textarea (max 500 chars counter)
  - Brand keywords input (comma-separated, display as chips, max 20)
  - Competitors known input (comma-separated, display as chips, max 20)
- All optional in form; submit includes null values as empty objects/arrays

### 6.2 New Profile Edit Page (Optional, Post-MVP)
- Add route `/dashboard/[clientId]/profile/edit`
- Reuse same form component
- Pre-populate with existing values
- POST to `PATCH /api/clients/:id/profile`

---

## 7. Database Migration

**File:** `prisma/schema/migrations/20260516XXXXXX_add_client_brand_profile/migration.sql`

```sql
-- Add brand profile fields to clients table
ALTER TABLE "clients" 
ADD COLUMN "digital_handles" JSONB,
ADD COLUMN "brand_description" TEXT,
ADD COLUMN "brand_keywords" JSONB,
ADD COLUMN "competitors_known" JSONB;

-- No indexes needed; these are optional, sparse columns
```

**Migration command:**
```bash
npx prisma migrate dev --schema prisma/schema --name add_client_brand_profile
```

---

## 8. Testing Strategy

### 8.1 Unit Tests (app/clients/__tests__/clients.service.spec.ts)
1. **updateClientProfile - happy path:** Valid data updates all 4 fields
2. **updateClientProfile - partial update:** Partial field set updates only provided fields
3. **updateClientProfile - tenant scoping:** Returns 404 if client belongs to different tenant
4. **updateClientProfile - validation failure:** DTO validation catches oversized arrays, long strings
5. **DTO validation - digital_handles:** Accepts valid object, rejects invalid types
6. **DTO validation - brand_keywords:** Rejects >20 items, <2 char items, non-string items

### 8.2 E2E Tests (app/clients/__tests__/clients.e2e.spec.ts)
1. **POST /clients/:id/profile - auth required:** 401 without JWT
2. **POST /clients/:id/profile - tenant scoped:** 403 if different tenant, 200 if same tenant
3. **POST /clients/:id/profile - full update:** All fields update correctly
4. **POST /clients/:id/profile - partial update:** Only specified fields update
5. **POST /clients/:id/profile - validation errors:** 400 on oversized arrays/strings
6. **Existing tests remain green:** 204 tests unchanged

### 8.3 Frontend Tests (optional, smoke)
- Form renders all new fields
- Validation shows max-length errors
- Chips display for array fields

---

## 9. Rollout & Verification

### 9.1 Pre-deployment
```bash
# Run migration
npx prisma migrate dev --schema prisma/schema --name add_client_brand_profile

# Run all tests
npx jest --testPathPattern=clients   # Target: 210/210 passing (204 + 6 new)
npx jest                              # All suites green
npx tsc --noEmit                      # 0 errors

# Build
npm run build                         # Production build succeeds
```

### 9.2 Post-deployment
- Verify PATCH endpoint responds 200 on valid input
- Verify 400 on oversized arrays/strings
- Verify tenant scoping (403 on wrong tenant)
- Verify existing clients load without errors (new fields are null)

---

## 10. Out of Scope

- Competitor auto-mapping to `competitors_known` (manual user entry only for Phase 12+)
- Bulk profile updates (single-client API only)
- Profile deletion/reset (just update to null)
- Social handle URL normalization (accept as-is)
- Keyword ranking suggestions (future analytics feature)

---

## 11. Success Criteria

- [ ] Schema migration applies cleanly
- [ ] 210/210 jest tests pass (204 existing + 6 new)
- [ ] 0 tsc errors
- [ ] PATCH endpoint validates all fields correctly
- [ ] Tenant scoping enforced (403 on cross-tenant access)
- [ ] Frontend form extends without breaking existing onboarding flow
- [ ] All existing clients work unchanged (nulls don't break queries)
- [ ] Git commit: `[TASK-012] feat: add brand profile + digital handles to Client entity`

---

## 12. Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `prisma/schema/schema.prisma` | Add 4 fields to Client model | +4 |
| `app/clients/dto/update-client-profile.dto.ts` | New DTO file | ~60 |
| `app/clients/clients.service.ts` | Add updateClientProfile() method | +30 |
| `app/clients/clients.controller.ts` | Add @Patch(':id/profile') endpoint | +10 |
| `app/clients/__tests__/clients.service.spec.ts` | Add 6 unit tests | +100 |
| `app/clients/__tests__/clients.e2e.spec.ts` | Add 2 E2E tests | +50 |
| `frontend/app/dashboard/new-client/page.tsx` | Extend form with new fields | +80 |
| `prisma/schema/migrations/YYYYMMDD/migration.sql` | New migration | ~10 |

**Total additions:** ~350 lines code + migrations

---
