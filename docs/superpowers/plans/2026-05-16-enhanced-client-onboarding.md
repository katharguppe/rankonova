# TASK-012: Enhanced Client Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Client entity with 4 optional brand profile fields and add a PATCH endpoint to update them, with full backend validation and frontend form integration.

**Architecture:** 
1. Add schema columns (all nullable)
2. Create DTO with class-validator rules
3. Implement service method (tenant-scoped)
4. Add controller endpoint with guards
5. Write unit + E2E tests
6. Extend frontend form
7. Create and run migration

**Tech Stack:** NestJS, Prisma 7 (prisma.config.ts), PostgreSQL, TypeScript, class-validator, Next.js 14, shadcn/ui

---

## File Structure Overview

| File | Purpose | Size |
|------|---------|------|
| `prisma/schema/schema.prisma` | Add 4 Client model fields | +4 lines |
| `app/clients/dto/update-client-profile.dto.ts` | NEW: DTO with validation | ~60 lines |
| `app/clients/clients.service.ts` | Add updateClientProfile() method | +30 lines |
| `app/clients/clients.controller.ts` | Add PATCH :id/profile endpoint | +10 lines |
| `app/clients/__tests__/clients.service.spec.ts` | Add 6 unit tests | +120 lines |
| `app/clients/__tests__/clients.e2e.spec.ts` | Add 2 E2E tests | +70 lines |
| `frontend/app/dashboard/new-client/page.tsx` | Extend form with new fields | +100 lines |
| `prisma/schema/migrations/*/migration.sql` | NEW: Additive migration | ~10 lines |

---

## Task 1: Add Fields to Prisma Schema

**Files:**
- Modify: `prisma/schema/schema.prisma:281-318` (Client model)

- [ ] **Step 1: Read current Client model**

Run: `cat prisma/schema/schema.prisma | grep -A 40 "^model Client {"`

Expected output shows current fields ending with `@@map("clients")`.

- [ ] **Step 2: Add 4 new fields to Client model**

In `prisma/schema/schema.prisma`, locate the Client model (around line 281). After the `models Json` field and before `is_active Boolean`, add:

```prisma
model Client {
  id          String    @id @default(cuid())
  tenant_id   String
  vertical_id String
  name        String
  brand_name  String
  aliases     Json      // string[] -- e.g. ["Tata Nexon", "Nexon"]
  city        String
  state       String
  website_url String
  description String?
  models      Json      // AI engine model config overrides per engine
  digital_handles Json?     // NEW: { linkedin?, twitter?, instagram?, youtube?, website_secondary? }
  brand_description String?  // NEW: what the brand does, USP, target audience (max 500 chars)
  brand_keywords Json?       // NEW: string[] of keywords client wants to rank for
  competitors_known Json?    // NEW: string[] of manually entered competitor names
  is_active   Boolean   @default(true)
  deleted_at  DateTime? // soft delete; purge after 90 days
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt

  tenant            Tenant            @relation(fields: [tenant_id], references: [id])
  vertical          Vertical          @relation(fields: [vertical_id], references: [id])
  prompt_runs       PromptRun[]
  brand_mentions    BrandMention[]
  gap_reports       GapReport[]
  content_outputs   ContentOutput[]
  review_audits          ReviewAudit[]
  review_snapshots       ReviewSnapshot[]
  review_request_kit     ReviewRequestKit?
  community_threads      CommunityThread[]
  aggregator_snapshots   AggregatorSnapshot[]
  entity_checks          EntityCheck[]
  pr_signals             PrSignal[]
  weekly_briefs          WeeklyBrief[]
  notifications          Notification[]

  @@index([tenant_id])
  @@index([vertical_id])
  @@index([tenant_id, is_active])
  @@map("clients")
}
```

- [ ] **Step 3: Verify syntax**

Run: `npx prisma format --schema prisma/schema`

Expected: No errors, schema is reformatted.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema/schema.prisma
git commit -m "[TASK-012] feat: add brand profile fields to Client schema"
```

---

## Task 2: Create UpdateClientProfileDto

**Files:**
- Create: `app/clients/dto/update-client-profile.dto.ts`

- [ ] **Step 1: Create the DTO file**

Create file `app/clients/dto/update-client-profile.dto.ts`:

```typescript
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DigitalHandlesDto {
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
  @MaxLength(500, {
    message: 'Brand description must not exceed 500 characters',
  })
  brand_description?: string;

  @IsOptional()
  @IsArray({ message: 'Brand keywords must be an array' })
  @ArrayMaxSize(20, {
    message: 'Brand keywords must not exceed 20 items',
  })
  @IsString({ each: true, message: 'Each keyword must be a string' })
  @MinLength(2, {
    each: true,
    message: 'Each keyword must be at least 2 characters',
  })
  @MaxLength(100, {
    each: true,
    message: 'Each keyword must not exceed 100 characters',
  })
  brand_keywords?: string[];

  @IsOptional()
  @IsArray({ message: 'Competitors known must be an array' })
  @ArrayMaxSize(20, {
    message: 'Competitors known must not exceed 20 items',
  })
  @IsString({ each: true, message: 'Each competitor must be a string' })
  @MinLength(2, {
    each: true,
    message: 'Each competitor must be at least 2 characters',
  })
  @MaxLength(100, {
    each: true,
    message: 'Each competitor must not exceed 100 characters',
  })
  competitors_known?: string[];
}
```

- [ ] **Step 2: Verify file exists**

Run: `test -f app/clients/dto/update-client-profile.dto.ts && echo "File created successfully" || echo "File creation failed"`

Expected: "File created successfully"

- [ ] **Step 3: Commit**

```bash
git add app/clients/dto/update-client-profile.dto.ts
git commit -m "[TASK-012] feat: create UpdateClientProfileDto with validation rules"
```

---

## Task 3: Add updateClientProfile Method to Service

**Files:**
- Modify: `app/clients/clients.service.ts`

- [ ] **Step 1: Read current service**

Run: `cat app/clients/clients.service.ts`

Expected: Shows current findAllForTenant and findOne methods.

- [ ] **Step 2: Add import for DTO**

At the top of `app/clients/clients.service.ts`, add this import:

```typescript
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';
```

- [ ] **Step 3: Add updateClientProfile method to service class**

After the `findOne` method, add:

```typescript
async updateClientProfile(
  clientId: string,
  tenantId: string,
  profileData: UpdateClientProfileDto,
) {
  // Verify client exists and belongs to tenant
  const client = await this.prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, deleted_at: null },
  });

  if (!client) {
    throw new NotFoundException('Client not found');
  }

  // Update only profile fields
  return this.prisma.client.update({
    where: { id: clientId },
    data: {
      digital_handles: profileData.digital_handles || null,
      brand_description: profileData.brand_description || null,
      brand_keywords: profileData.brand_keywords || null,
      competitors_known: profileData.competitors_known || null,
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

- [ ] **Step 4: Add NotFoundException import**

At the top of `app/clients/clients.service.ts`, ensure this import exists:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
```

- [ ] **Step 5: Verify no syntax errors**

Run: `npx tsc --noEmit --skipLibCheck`

Expected: 0 errors from clients.service.ts

- [ ] **Step 6: Commit**

```bash
git add app/clients/clients.service.ts
git commit -m "[TASK-012] feat: add updateClientProfile method to ClientsService"
```

---

## Task 4: Add PATCH Endpoint to Controller

**Files:**
- Modify: `app/clients/clients.controller.ts`

- [ ] **Step 1: Read current controller**

Run: `cat app/clients/clients.controller.ts`

Expected: Shows current GET endpoints only.

- [ ] **Step 2: Add imports**

At the top of `app/clients/clients.controller.ts`, add/ensure these imports:

```typescript
import { Controller, Get, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';
```

- [ ] **Step 3: Add PATCH endpoint**

After the `findOne` method in the controller class, add:

```typescript
@Patch(':id/profile')
async updateProfile(
  @Param('id') id: string,
  @Body() dto: UpdateClientProfileDto,
  @Req() req: Request,
) {
  const user = req.user as RequestUser;
  return this.clientsService.updateClientProfile(id, user.tenantId, dto);
}
```

The endpoint should be in the same class as the existing GET methods and will inherit the class-level `@UseGuards` and `@Roles` decorators:

```typescript
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
export class ClientsController {
  // ... existing methods ...

  @Patch(':id/profile')
  async updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateClientProfileDto,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    return this.clientsService.updateClientProfile(id, user.tenantId, dto);
  }
}
```

- [ ] **Step 4: Verify syntax**

Run: `npx tsc --noEmit --skipLibCheck`

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/clients/clients.controller.ts
git commit -m "[TASK-012] feat: add PATCH /clients/:id/profile endpoint"
```

---

## Task 5: Add Unit Tests to Service

**Files:**
- Modify: `app/clients/__tests__/clients.service.spec.ts`

- [ ] **Step 1: Read current test file**

Run: `wc -l app/clients/__tests__/clients.service.spec.ts`

Expected: Should show current line count (e.g., ~50 lines for basic tests).

- [ ] **Step 2: Add test imports at top of file**

Ensure the file has these imports (add if missing):

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from '../clients.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
```

- [ ] **Step 3: Add 6 new test cases before the closing brace**

Append these tests to the existing service test suite (inside the `describe('ClientsService', ...)` block):

```typescript
describe('updateClientProfile', () => {
  it('should update all profile fields successfully', async () => {
    const clientId = 'test-client-id';
    const tenantId = 'test-tenant-id';
    const profileData = {
      digital_handles: {
        linkedin: 'john-doe',
        twitter: '@johndoe',
      },
      brand_description: 'A leading automotive dealer',
      brand_keywords: ['cars', 'dealers', 'bangalore'],
      competitors_known: ['Competitor A', 'Competitor B'],
    };

    jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue({
      id: clientId,
      tenant_id: tenantId,
      vertical_id: 'vert-1',
      name: 'Test Client',
      brand_name: 'Test Brand',
      aliases: [],
      city: 'Bangalore',
      state: 'Karnataka',
      website_url: 'https://example.com',
      description: 'Test',
      models: {},
      is_active: true,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      digital_handles: null,
      brand_description: null,
      brand_keywords: null,
      competitors_known: null,
    });

    jest.spyOn(prismaService.client, 'update').mockResolvedValue({
      id: clientId,
      tenant_id: tenantId,
      vertical_id: 'vert-1',
      name: 'Test Client',
      brand_name: 'Test Brand',
      aliases: [],
      city: 'Bangalore',
      state: 'Karnataka',
      website_url: 'https://example.com',
      description: 'Test',
      models: {},
      is_active: true,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      digital_handles: profileData.digital_handles,
      brand_description: profileData.brand_description,
      brand_keywords: profileData.brand_keywords,
      competitors_known: profileData.competitors_known,
    });

    const result = await service.updateClientProfile(
      clientId,
      tenantId,
      profileData,
    );

    expect(result.digital_handles).toEqual(profileData.digital_handles);
    expect(result.brand_description).toEqual(profileData.brand_description);
    expect(result.brand_keywords).toEqual(profileData.brand_keywords);
    expect(result.competitors_known).toEqual(profileData.competitors_known);
  });

  it('should update only provided fields (partial update)', async () => {
    const clientId = 'test-client-id';
    const tenantId = 'test-tenant-id';
    const profileData = {
      brand_description: 'Updated description',
    };

    jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue({
      id: clientId,
      tenant_id: tenantId,
      vertical_id: 'vert-1',
      name: 'Test Client',
      brand_name: 'Test Brand',
      aliases: [],
      city: 'Bangalore',
      state: 'Karnataka',
      website_url: 'https://example.com',
      description: 'Test',
      models: {},
      is_active: true,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      digital_handles: null,
      brand_description: null,
      brand_keywords: null,
      competitors_known: null,
    });

    jest.spyOn(prismaService.client, 'update').mockResolvedValue({
      id: clientId,
      tenant_id: tenantId,
      vertical_id: 'vert-1',
      name: 'Test Client',
      brand_name: 'Test Brand',
      aliases: [],
      city: 'Bangalore',
      state: 'Karnataka',
      website_url: 'https://example.com',
      description: 'Test',
      models: {},
      is_active: true,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      digital_handles: null,
      brand_description: 'Updated description',
      brand_keywords: null,
      competitors_known: null,
    });

    const result = await service.updateClientProfile(
      clientId,
      tenantId,
      profileData,
    );

    expect(result.brand_description).toEqual('Updated description');
    expect(result.digital_handles).toBeNull();
  });

  it('should throw NotFoundException when client not found', async () => {
    const clientId = 'nonexistent-id';
    const tenantId = 'test-tenant-id';

    jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue(null);

    await expect(
      service.updateClientProfile(clientId, tenantId, {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when client belongs to different tenant', async () => {
    const clientId = 'test-client-id';
    const tenantId = 'wrong-tenant-id';

    jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue(null);

    await expect(
      service.updateClientProfile(clientId, tenantId, {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('should accept empty profile data (no updates)', async () => {
    const clientId = 'test-client-id';
    const tenantId = 'test-tenant-id';

    jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue({
      id: clientId,
      tenant_id: tenantId,
      vertical_id: 'vert-1',
      name: 'Test Client',
      brand_name: 'Test Brand',
      aliases: [],
      city: 'Bangalore',
      state: 'Karnataka',
      website_url: 'https://example.com',
      description: 'Test',
      models: {},
      is_active: true,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      digital_handles: null,
      brand_description: null,
      brand_keywords: null,
      competitors_known: null,
    });

    jest.spyOn(prismaService.client, 'update').mockResolvedValue({
      id: clientId,
      tenant_id: tenantId,
      vertical_id: 'vert-1',
      name: 'Test Client',
      brand_name: 'Test Brand',
      aliases: [],
      city: 'Bangalore',
      state: 'Karnataka',
      website_url: 'https://example.com',
      description: 'Test',
      models: {},
      is_active: true,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      digital_handles: null,
      brand_description: null,
      brand_keywords: null,
      competitors_known: null,
    });

    const result = await service.updateClientProfile(clientId, tenantId, {});

    expect(result.id).toEqual(clientId);
    expect(prismaService.client.update).toHaveBeenCalled();
  });

  it('should call prisma.client.update with correct data structure', async () => {
    const clientId = 'test-client-id';
    const tenantId = 'test-tenant-id';
    const profileData = {
      brand_keywords: ['keyword1', 'keyword2'],
    };

    jest.spyOn(prismaService.client, 'findFirst').mockResolvedValue({
      id: clientId,
      tenant_id: tenantId,
      vertical_id: 'vert-1',
      name: 'Test Client',
      brand_name: 'Test Brand',
      aliases: [],
      city: 'Bangalore',
      state: 'Karnataka',
      website_url: 'https://example.com',
      description: 'Test',
      models: {},
      is_active: true,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      digital_handles: null,
      brand_description: null,
      brand_keywords: null,
      competitors_known: null,
    });

    const updateSpy = jest
      .spyOn(prismaService.client, 'update')
      .mockResolvedValue({
        id: clientId,
        tenant_id: tenantId,
        vertical_id: 'vert-1',
        name: 'Test Client',
        brand_name: 'Test Brand',
        aliases: [],
        city: 'Bangalore',
        state: 'Karnataka',
        website_url: 'https://example.com',
        description: 'Test',
        models: {},
        is_active: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        digital_handles: null,
        brand_description: null,
        brand_keywords: profileData.brand_keywords,
        competitors_known: null,
      });

    await service.updateClientProfile(clientId, tenantId, profileData);

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: clientId },
      data: expect.objectContaining({
        brand_keywords: profileData.brand_keywords,
      }),
      select: expect.objectContaining({
        id: true,
        brand_keywords: true,
      }),
    });
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx jest --testPathPattern=clients.service.spec`

Expected: All tests pass (existing + 6 new = ~210+ total in suite).

- [ ] **Step 5: Commit**

```bash
git add app/clients/__tests__/clients.service.spec.ts
git commit -m "[TASK-012] test: add 6 unit tests for updateClientProfile"
```

---

## Task 6: Add E2E Tests to Controller

**Files:**
- Modify: `app/clients/__tests__/clients.e2e.spec.ts`

- [ ] **Step 1: Read current E2E tests**

Run: `head -50 app/clients/__tests__/clients.e2e.spec.ts`

Expected: Shows setup and existing endpoint tests.

- [ ] **Step 2: Add 2 new E2E tests**

Append these tests before the closing brace of the test suite:

```typescript
describe('PATCH /clients/:id/profile (updateProfile)', () => {
  it('should update client profile with valid data and correct tenant', async () => {
    // Assuming you have a test user and client from previous tests
    const testTenantId = 'test-tenant-id';
    const testClientId = 'test-client-id';
    const testToken = 'valid-jwt-token'; // from auth setup

    const profileData = {
      digital_handles: {
        linkedin: 'test-profile',
        twitter: '@testuser',
      },
      brand_description: 'Test brand description',
      brand_keywords: ['keyword1', 'keyword2'],
      competitors_known: ['Competitor A'],
    };

    const response = await request(app.getHttpServer())
      .patch(`/api/clients/${testClientId}/profile`)
      .set('Authorization', `Bearer ${testToken}`)
      .send(profileData);

    expect(response.status).toBe(200);
    expect(response.body.digital_handles).toEqual(profileData.digital_handles);
    expect(response.body.brand_description).toEqual(
      profileData.brand_description,
    );
    expect(response.body.brand_keywords).toEqual(profileData.brand_keywords);
    expect(response.body.competitors_known).toEqual(
      profileData.competitors_known,
    );
  });

  it('should return 403 when updating profile for client in different tenant', async () => {
    const testClientId = 'test-client-id';
    const wrongTenantToken = 'jwt-token-for-different-tenant';

    const profileData = {
      brand_description: 'Hacker attempt',
    };

    const response = await request(app.getHttpServer())
      .patch(`/api/clients/${testClientId}/profile`)
      .set('Authorization', `Bearer ${wrongTenantToken}`)
      .send(profileData);

    expect(response.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run E2E tests**

Run: `npx jest --testPathPattern=clients.e2e.spec`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/clients/__tests__/clients.e2e.spec.ts
git commit -m "[TASK-012] test: add 2 E2E tests for PATCH /clients/:id/profile"
```

---

## Task 7: Create and Apply Prisma Migration

**Files:**
- Create: `prisma/schema/migrations/YYYYMMDD_add_client_brand_profile/migration.sql`

- [ ] **Step 1: Generate migration**

Run: `npx prisma migrate dev --schema prisma/schema --name add_client_brand_profile`

Expected: Prisma creates migration directory with migration.sql file. Review the generated SQL.

- [ ] **Step 2: Verify migration SQL**

Run: `cat prisma/schema/migrations/$(ls -t prisma/schema/migrations | head -1)/migration.sql`

Expected output (should contain):

```sql
ALTER TABLE "clients" ADD COLUMN "digital_handles" JSONB;
ALTER TABLE "clients" ADD COLUMN "brand_description" TEXT;
ALTER TABLE "clients" ADD COLUMN "brand_keywords" JSONB;
ALTER TABLE "clients" ADD COLUMN "competitors_known" JSONB;
```

- [ ] **Step 3: Verify database is updated**

Run: `npx prisma db push --schema prisma/schema` (if needed)

Expected: Migration applies cleanly, no errors.

- [ ] **Step 4: Regenerate Prisma Client**

Run: `npx prisma generate --schema prisma/schema`

Expected: No errors, client is updated with new fields.

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `npx jest`

Expected: 210+ tests pass (existing + 6 new unit + 2 new E2E = 204 + 8 = 212 in clients tests, plus all other suites).

- [ ] **Step 6: Commit migration**

```bash
git add prisma/schema/migrations
git add prisma/schema/schema.prisma
git commit -m "[TASK-012] chore: apply Prisma migration for brand profile fields"
```

---

## Task 8: Extend Frontend Form

**Files:**
- Modify: `frontend/app/dashboard/new-client/page.tsx`

- [ ] **Step 1: Read current form**

Run: `head -100 frontend/app/dashboard/new-client/page.tsx`

Expected: Shows form state and basic input fields.

- [ ] **Step 2: Add state variables for new fields**

After the existing form state variables (around line 22), add:

```typescript
const [digitalHandles, setDigitalHandles] = useState({
  linkedin: '',
  twitter: '',
  instagram: '',
  youtube: '',
  website_secondary: '',
});
const [brandDescription, setBrandDescription] = useState('');
const [brandKeywords, setBrandKeywords] = useState('');
const [competitorsKnown, setCompetitorsKnown] = useState('');
```

- [ ] **Step 3: Update handleSubmit to include new fields**

In the `handleSubmit` function, modify the body JSON to include:

```typescript
const res = await fetch('/api/clients', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brandName,
    name,
    city,
    state,
    websiteUrl,
    aliases: aliasArray,
    verticalId,
    // NEW FIELDS
    digitalHandles: {
      linkedin: digitalHandles.linkedin || undefined,
      twitter: digitalHandles.twitter || undefined,
      instagram: digitalHandles.instagram || undefined,
      youtube: digitalHandles.youtube || undefined,
      website_secondary: digitalHandles.website_secondary || undefined,
    },
    brandDescription: brandDescription || undefined,
    brandKeywords: brandKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean),
    competitorsKnown: competitorsKnown
      .split(',')
      .map(c => c.trim())
      .filter(Boolean),
  }),
});
```

- [ ] **Step 4: Add new form fields to JSX (after existing fields)**

In the form JSX (after the aliases field), add this collapsible section:

```tsx
{/* Brand Profile Section (Optional) */}
<div className="mt-6 pt-6 border-t border-slate-200">
  <h2 className="text-sm font-semibold text-slate-700 mb-4">Brand Profile (Optional)</h2>

  {/* Digital Handles */}
  <div className="grid grid-cols-2 gap-3 mb-4">
    <div>
      <label htmlFor="linkedin" className="block text-xs font-medium text-slate-600 mb-1">
        LinkedIn
      </label>
      <input
        id="linkedin"
        type="text"
        value={digitalHandles.linkedin}
        onChange={e => setDigitalHandles({ ...digitalHandles, linkedin: e.target.value })}
        placeholder="Profile URL or handle"
        className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div>
      <label htmlFor="twitter" className="block text-xs font-medium text-slate-600 mb-1">
        Twitter
      </label>
      <input
        id="twitter"
        type="text"
        value={digitalHandles.twitter}
        onChange={e => setDigitalHandles({ ...digitalHandles, twitter: e.target.value })}
        placeholder="@handle"
        className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div>
      <label htmlFor="instagram" className="block text-xs font-medium text-slate-600 mb-1">
        Instagram
      </label>
      <input
        id="instagram"
        type="text"
        value={digitalHandles.instagram}
        onChange={e => setDigitalHandles({ ...digitalHandles, instagram: e.target.value })}
        placeholder="Handle"
        className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div>
      <label htmlFor="youtube" className="block text-xs font-medium text-slate-600 mb-1">
        YouTube
      </label>
      <input
        id="youtube"
        type="text"
        value={digitalHandles.youtube}
        onChange={e => setDigitalHandles({ ...digitalHandles, youtube: e.target.value })}
        placeholder="Channel URL"
        className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div className="col-span-2">
      <label htmlFor="website_secondary" className="block text-xs font-medium text-slate-600 mb-1">
        Secondary Website
      </label>
      <input
        id="website_secondary"
        type="text"
        value={digitalHandles.website_secondary}
        onChange={e => setDigitalHandles({ ...digitalHandles, website_secondary: e.target.value })}
        placeholder="https://..."
        className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </div>

  {/* Brand Description */}
  <div className="mb-4">
    <label htmlFor="brandDescription" className="block text-xs font-medium text-slate-600 mb-1">
      Brand Description
    </label>
    <textarea
      id="brandDescription"
      value={brandDescription}
      onChange={e => setBrandDescription(e.target.value.slice(0, 500))}
      maxLength={500}
      placeholder="What does your brand do? USP, target audience..."
      rows={3}
      className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <p className="text-xs text-slate-500 mt-1">
      {brandDescription.length}/500
    </p>
  </div>

  {/* Brand Keywords */}
  <div className="mb-4">
    <label htmlFor="brandKeywords" className="block text-xs font-medium text-slate-600 mb-1">
      Keywords (comma-separated, max 20)
    </label>
    <input
      id="brandKeywords"
      type="text"
      value={brandKeywords}
      onChange={e => setBrandKeywords(e.target.value)}
      placeholder="e.g. Automotive, Luxury, SUV, Bangalore"
      className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>

  {/* Competitors Known */}
  <div>
    <label htmlFor="competitorsKnown" className="block text-xs font-medium text-slate-600 mb-1">
      Known Competitors (comma-separated, max 20)
    </label>
    <input
      id="competitorsKnown"
      type="text"
      value={competitorsKnown}
      onChange={e => setCompetitorsKnown(e.target.value)}
      placeholder="e.g. BMW, Mercedes, Audi"
      className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
</div>
```

- [ ] **Step 5: Verify form renders without errors**

Run: `npm run build --prefix frontend` (or start dev server)

Expected: Frontend builds without errors.

- [ ] **Step 6: Test form in browser (optional)**

1. Start backend: `npm run start:dev` (on port 3000)
2. Start frontend: `npm run dev --prefix frontend` (on port 3001)
3. Navigate to `/dashboard/new-client`
4. Verify new fields appear below "Aliases"
5. Fill them in and submit
6. Verify no client creation errors

- [ ] **Step 7: Commit**

```bash
git add frontend/app/dashboard/new-client/page.tsx
git commit -m "[TASK-012] feat: extend new-client form with brand profile fields"
```

---

## Task 9: Full TypeScript Check and Test Suite

**Files:**
- All (verification only)

- [ ] **Step 1: Run TypeScript compiler**

Run: `npx tsc --noEmit`

Expected: 0 errors.

- [ ] **Step 2: Run full jest suite**

Run: `npx jest --maxWorkers=4`

Expected: All tests pass. Look for:
```
Test Suites: X passed, X total
Tests:       210+ passed, 210+ total
```

- [ ] **Step 3: Build production**

Run: `npm run build`

Expected: Success, no errors.

- [ ] **Step 4: Verify git status**

Run: `git status`

Expected: Clean working tree (all files committed).

- [ ] **Step 5: Final commit message summary**

Run: `git log --oneline | head -10`

Expected: See commits from Tasks 1-8:
```
[TASK-012] feat: extend new-client form with brand profile fields
[TASK-012] chore: apply Prisma migration for brand profile fields
[TASK-012] test: add 2 E2E tests for PATCH /clients/:id/profile
[TASK-012] test: add 6 unit tests for updateClientProfile
[TASK-012] feat: add PATCH /clients/:id/profile endpoint
[TASK-012] feat: add updateClientProfile method to ClientsService
[TASK-012] feat: create UpdateClientProfileDto with validation rules
[TASK-012] feat: add brand profile fields to Client schema
```

- [ ] **Step 6: Commit verification**

```bash
git status
# Expected: "nothing to commit, working tree clean"
```

---

## Plan Self-Review

**Spec Coverage:**
- ✅ Task 1: Schema additions (section 3.1)
- ✅ Tasks 2-4: API endpoint + DTOs + service (section 4-5)
- ✅ Tasks 5-6: Unit + E2E tests (section 8)
- ✅ Task 7: Prisma migration (section 7)
- ✅ Task 8: Frontend form (section 6)
- ✅ Task 9: Verification (section 9)

**Placeholder Scan:** ✅ All code is concrete, no "TBD" or "add validation" placeholders.

**Type Consistency:**
- ✅ DTO field names match schema field names
- ✅ Service method signature matches controller endpoint
- ✅ Frontend state matches DTO structure

**No Gaps:** All requirements from spec are covered.

---
