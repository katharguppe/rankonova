# Agent Prompt Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `AgentPromptGeneratorService` that calls Claude Sonnet via structured tool-use to generate 25 targeted prompts per client from their brand profile, stored as tenant custom prompts tagged `source='agent'`.

**Architecture:** New `AgentPromptGeneratorService` registered in `PromptEngineModule`. One Anthropic SDK `messages.create` call with a `store_prompts` tool schema forces structured JSON output. Prompts are bulk-inserted via `prisma.prompt.createMany()` scoped to the client. Idempotency: skip if >= `AGENT_PROMPT_COUNT` agent prompts already exist for that client.

**Tech Stack:** NestJS, TypeScript 5.x, `@anthropic-ai/sdk ^0.36.0`, Prisma 7, PostgreSQL 15.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `prisma/schema/schema.prisma` | Add `source` + `client_id` to `Prompt` model |
| Create | `prisma/schema/migrations/*/migration.sql` | Additive migration for new columns |
| Create | `app/prompt-engine/agent-prompt-generator.service.ts` | Core generation logic |
| Create | `app/prompt-engine/agent-prompt-generator.service.spec.ts` | Unit tests (Anthropic SDK mocked) |
| Modify | `app/prompt-engine/prompt-engine.module.ts` | Register new service in `providers[]` |
| Modify | `app/prompt-engine/prompt-engine.controller.ts` | Add `POST /prompt-engine/clients/:clientId/generate-prompts` |

---

## Task 1: Schema — add `source` and `client_id` to Prompt

**Files:**
- Modify: `prisma/schema/schema.prisma` (Prompt model, lines ~356–379)

- [ ] **Step 1: Edit schema**

In `prisma/schema/schema.prisma`, find the `model Prompt` block and add two fields after `priority Int @default(0)`:

```prisma
model Prompt {
  id          String     @id @default(cuid())
  vertical_id String?
  tenant_id   String?
  client_id   String?
  text        String
  category    String
  intent_type IntentType
  buyer_stage BuyerStage
  is_active   Boolean    @default(true)
  is_custom   Boolean    @default(false)
  source      String     @default("platform")
  priority    Int        @default(0)
  created_at  DateTime   @default(now())
  updated_at  DateTime   @updatedAt

  vertical        Vertical?       @relation(fields: [vertical_id], references: [id])
  tenant          Tenant?         @relation(fields: [tenant_id], references: [id])
  client          Client?         @relation(fields: [client_id], references: [id])
  prompt_runs     PromptRun[]
  content_outputs ContentOutput[]

  @@index([vertical_id])
  @@index([tenant_id])
  @@index([client_id])
  @@index([vertical_id, is_active])
  @@map("prompts")
}
```

Also add `agent_prompts Prompt[]` to the `Client` model relations block (after `prompt_runs PromptRun[]`).

- [ ] **Step 2: Add relation to Client model**

In the `model Client` block (around line 302), add `agent_prompts Prompt[]` after `prompt_runs PromptRun[]`:

```prisma
  prompt_runs          PromptRun[]
  agent_prompts        Prompt[]
```

- [ ] **Step 3: Run migration**

```powershell
npx prisma migrate dev --name add_prompt_source_and_client_id
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Regenerate Prisma client**

```powershell
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 5: Verify tsc still compiles**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```powershell
git add prisma/schema/schema.prisma prisma/schema/migrations/
git commit -m "[TASK-013] feat: add source and client_id fields to Prompt model"
```

---

## Task 2: Write failing tests for AgentPromptGeneratorService

**Files:**
- Create: `app/prompt-engine/agent-prompt-generator.service.spec.ts`

- [ ] **Step 1: Create the spec file**

```typescript
// app/prompt-engine/agent-prompt-generator.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AgentPromptGeneratorService } from './agent-prompt-generator.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock the Anthropic SDK module
jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

import Anthropic from '@anthropic-ai/sdk';

const mockPrisma = {
  client: { findFirst: jest.fn() },
  prompt: { count: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  vertical: { findUnique: jest.fn() },
};

const TENANT_USER = { userId: 'u1', tenantId: 'tenant1', role: 'tenant_admin' as const };

const mockClient = {
  id: 'c1',
  tenant_id: 'tenant1',
  vertical_id: 'v1',
  brand_description: 'We sell premium cars in Pune',
  brand_keywords: ['SUV', 'luxury', 'Pune'],
  digital_handles: { linkedin: 'https://linkedin.com/company/acme' },
};

const mockVertical = { id: 'v1', name: 'automotive' };

const mockClaudePrompts = Array.from({ length: 25 }, (_, i) => ({
  text: `Which SUV should I buy in Pune ${i + 1}?`,
  category: 'purchase',
  intent_type: 'purchase_intent',
  buyer_stage: 'consideration',
  priority: 5,
}));

describe('AgentPromptGeneratorService', () => {
  let service: AgentPromptGeneratorService;
  let anthropicInstance: { messages: { create: jest.Mock } };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentPromptGeneratorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AgentPromptGeneratorService>(AgentPromptGeneratorService);
    anthropicInstance = (Anthropic as jest.Mock).mock.results[0].value;
    jest.clearAllMocks();
  });

  it('generates and saves 25 prompts for a client with brand_description', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(mockClient);
    mockPrisma.prompt.count.mockResolvedValue(0);
    mockPrisma.vertical.findUnique.mockResolvedValue(mockVertical);
    anthropicInstance.messages.create.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'store_prompts',
          input: { prompts: mockClaudePrompts },
        },
      ],
    });
    mockPrisma.prompt.createMany.mockResolvedValue({ count: 25 });
    mockPrisma.prompt.findMany.mockResolvedValue(mockClaudePrompts.map((_, i) => ({ id: `p${i}` })));

    const result = await service.generateForClient('c1', TENANT_USER);

    expect(result.generated).toBe(25);
    expect(result.skipped).toBeUndefined();
    expect(mockPrisma.prompt.createMany).toHaveBeenCalledTimes(1);
    const createArgs = mockPrisma.prompt.createMany.mock.calls[0][0];
    expect(createArgs.data[0]).toMatchObject({
      is_custom: true,
      source: 'agent',
      client_id: 'c1',
      tenant_id: 'tenant1',
      vertical_id: 'v1',
    });
  });

  it('returns skipped:true when >= 25 agent prompts already exist for the client', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(mockClient);
    mockPrisma.prompt.count.mockResolvedValue(25);

    const result = await service.generateForClient('c1', TENANT_USER);

    expect(result).toEqual({ skipped: true, reason: 'prompts already generated' });
    expect(anthropicInstance.messages.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when client does not exist', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(null);

    await expect(service.generateForClient('bad-id', TENANT_USER))
      .rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when brand_description is missing', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ ...mockClient, brand_description: null });
    mockPrisma.prompt.count.mockResolvedValue(0);

    await expect(service.generateForClient('c1', TENANT_USER))
      .rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run tests — expect them to FAIL (service not yet created)**

```powershell
npx jest --testPathPattern=agent-prompt-generator --no-coverage
```

Expected: FAIL — `Cannot find module './agent-prompt-generator.service'`

---

## Task 3: Implement AgentPromptGeneratorService

**Files:**
- Create: `app/prompt-engine/agent-prompt-generator.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
// app/prompt-engine/agent-prompt-generator.service.ts
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IntentType, BuyerStage } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/jwt.strategy';

const AGENT_PROMPT_COUNT = parseInt(process.env['AGENT_PROMPT_COUNT'] ?? '25', 10);

interface GeneratedPrompt {
  text: string;
  category: string;
  intent_type: string;
  buyer_stage: string;
  priority: number;
}

@Injectable()
export class AgentPromptGeneratorService {
  private readonly logger = new Logger(AgentPromptGeneratorService.name);
  private readonly anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.anthropic = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
  }

  async generateForClient(
    clientId: string,
    user: RequestUser,
  ): Promise<{ generated: number; promptIds?: string[] } | { skipped: boolean; reason: string }> {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        is_active: true,
        deleted_at: null,
        ...(user.role !== 'super_admin' ? { tenant_id: user.tenantId } : {}),
      },
    });
    if (!client) throw new NotFoundException('Client not found');

    const existing = await this.prisma.prompt.count({
      where: { client_id: clientId, source: 'agent' },
    });
    if (existing >= AGENT_PROMPT_COUNT) {
      return { skipped: true, reason: 'prompts already generated' };
    }

    if (!client.brand_description) {
      throw new BadRequestException('brand_description is required to generate agent prompts');
    }

    const vertical = await this.prisma.vertical.findUnique({ where: { id: client.vertical_id } });
    const verticalName = vertical?.name ?? 'general';

    const keywords = Array.isArray(client.brand_keywords) ? (client.brand_keywords as string[]).join(', ') : '';
    const handles = client.digital_handles ? JSON.stringify(client.digital_handles) : 'none';

    const userMessage = `Generate exactly ${AGENT_PROMPT_COUNT} diverse search prompts that real users would type into an AI assistant when looking for a business in the "${verticalName}" vertical.

Brand context:
- Description: ${client.brand_description}
- Keywords to rank for: ${keywords}
- Digital handles: ${handles}

Requirements:
- Cover all 8 intent types: purchase_intent, comparison, feature_query, ownership, segment, local_discovery, trust_signal, price_query
- Cover all 4 buyer stages: awareness, consideration, decision, retention
- Make prompts realistic and specific to the brand context
- Use the store_prompts tool to return all ${AGENT_PROMPT_COUNT} prompts`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [
        {
          name: 'store_prompts',
          description: 'Store the generated prompts array',
          input_schema: {
            type: 'object' as const,
            properties: {
              prompts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    category: { type: 'string' },
                    intent_type: {
                      type: 'string',
                      enum: Object.values(IntentType),
                    },
                    buyer_stage: {
                      type: 'string',
                      enum: Object.values(BuyerStage),
                    },
                    priority: { type: 'number' },
                  },
                  required: ['text', 'category', 'intent_type', 'buyer_stage', 'priority'],
                },
              },
            },
            required: ['prompts'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'store_prompts' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === 'store_prompts');
    if (!toolUse || toolUse.type !== 'tool_use') {
      this.logger.warn(`AgentPromptGenerator: no tool_use block in Claude response for client ${clientId}`);
      return { generated: 0 };
    }

    const prompts = (toolUse.input as { prompts: GeneratedPrompt[] }).prompts;
    if (!prompts?.length) {
      this.logger.warn(`AgentPromptGenerator: empty prompts array for client ${clientId}`);
      return { generated: 0 };
    }

    if (prompts.length < AGENT_PROMPT_COUNT) {
      this.logger.warn(
        `AgentPromptGenerator: Claude returned ${prompts.length} prompts (expected ${AGENT_PROMPT_COUNT}) for client ${clientId}`,
      );
    }

    await this.prisma.prompt.createMany({
      data: prompts.map((p) => ({
        text: p.text,
        category: p.category,
        intent_type: p.intent_type as IntentType,
        buyer_stage: p.buyer_stage as BuyerStage,
        priority: p.priority,
        is_custom: true,
        source: 'agent',
        client_id: clientId,
        tenant_id: client.tenant_id,
        vertical_id: client.vertical_id,
        is_active: true,
      })),
      skipDuplicates: true,
    });

    const saved = await this.prisma.prompt.findMany({
      where: { client_id: clientId, source: 'agent' },
      select: { id: true },
    });

    return { generated: saved.length, promptIds: saved.map((p) => p.id) };
  }
}
```

- [ ] **Step 2: Run tests — expect them to PASS**

```powershell
npx jest --testPathPattern=agent-prompt-generator --no-coverage
```

Expected: 4 tests pass, 0 failures.

- [ ] **Step 3: Commit**

```powershell
git add app/prompt-engine/agent-prompt-generator.service.ts app/prompt-engine/agent-prompt-generator.service.spec.ts
git commit -m "[TASK-013] feat: AgentPromptGeneratorService with Claude tool-use structured output"
```

---

## Task 4: Register service in module and add controller endpoint

**Files:**
- Modify: `app/prompt-engine/prompt-engine.module.ts`
- Modify: `app/prompt-engine/prompt-engine.controller.ts`

- [ ] **Step 1: Register in module**

In `app/prompt-engine/prompt-engine.module.ts`, add the import and provider:

```typescript
import { AgentPromptGeneratorService } from './agent-prompt-generator.service';

// Inside @Module providers array, after PromptEngineService:
AgentPromptGeneratorService,
```

Full updated providers array:
```typescript
providers: [
  PromptEngineService,
  AgentPromptGeneratorService,   // <-- add this
  PromptRunQueueService,
  PromptRunWorker,
  PromptEngineScheduler,
  EngineAdapterFactory,
  CerebrasAdapter,
  ChatGptAdapter,
  PerplexityAdapter,
  GeminiAdapter,
  ClaudeAdapter,
  GrokAdapter,
  GoogleAioAdapter,
  EngineRateLimiterService,
  CostTrackerService,
  {
    provide: PE_REDIS,
    useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
  },
],
```

- [ ] **Step 2: Add endpoint to controller**

In `app/prompt-engine/prompt-engine.controller.ts`, add the import and new method:

```typescript
import { AgentPromptGeneratorService } from './agent-prompt-generator.service';

// In constructor, add:
constructor(
  private readonly service: PromptEngineService,
  private readonly agentPromptGenerator: AgentPromptGeneratorService,
) {}

// New endpoint (add after the existing triggerClientRun method):
@Post('clients/:clientId/generate-prompts')
@Roles(UserRole.super_admin, UserRole.tenant_admin)
generatePrompts(@Param('clientId') clientId: string, @Req() req: Request) {
  return this.agentPromptGenerator.generateForClient(clientId, req.user as RequestUser);
}
```

- [ ] **Step 3: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run all prompt-engine tests**

```powershell
npx jest --testPathPattern=prompt-engine --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add app/prompt-engine/prompt-engine.module.ts app/prompt-engine/prompt-engine.controller.ts
git commit -m "[TASK-013] feat: register AgentPromptGeneratorService and add POST generate-prompts endpoint"
```

---

## Task 5: Final verification and cleanup commit

- [ ] **Step 1: Run the full jest suite**

```powershell
npx jest --no-coverage
```

Expected: all existing tests pass, 0 regressions.

- [ ] **Step 2: Run tsc**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Verify git status is clean**

```powershell
git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 4: Final summary commit (if any stray files)**

If any files are unstaged:
```powershell
git add <files>
git commit -m "[TASK-013] chore: cleanup after agent prompt generator implementation"
```

---

## Manual Verification Guide

After implementation, here's how to manually confirm everything works end-to-end:

### 1. Confirm migration ran
```powershell
npx prisma studio
```
Open `Prompt` table → verify `source` column exists with default `platform`, and `client_id` column exists as nullable.

### 2. Call the endpoint
Use Thunder Client or curl. First get a JWT token (demo@aeo-suite.local / Demo@2026!):

```bash
# Login
POST http://localhost:3000/auth/login
{ "email": "demo@aeo-suite.local", "password": "Demo@2026!" }
# Copy accessToken

# Generate prompts for stress client
POST http://localhost:3000/prompt-engine/clients/cmonwtk9r00002ku9q59ge1h4/generate-prompts
Authorization: Bearer <accessToken>
```

Expected response:
```json
{ "generated": 25, "promptIds": ["...", "..."] }
```

### 3. Verify in DB
```powershell
npx prisma studio
```
Filter `Prompt` table by `source = agent` and `client_id = cmonwtk9r00002ku9q59ge1h4` → should see 25 rows.

### 4. Test idempotency
Call the same endpoint again immediately:
```json
{ "skipped": true, "reason": "prompts already generated" }
```

### 5. Test missing brand_description
Use a client that has no brand_description set → expect `400 Bad Request`.
