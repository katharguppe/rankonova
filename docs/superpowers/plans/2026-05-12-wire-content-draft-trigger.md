# Wire Content Draft Auto-Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement auto-generation of 1 FAQ page per worst-performing prompt (3 total) when the Weekly Brief pipeline runs, using `ContentAgentService.generateContent` with parallel execution via `Promise.allSettled()`.

**Architecture:** The Weekly Brief generation pipeline (Phase 9, step 9) identifies the 3 worst-performing prompts by citation rate. The `DownstreamTrigger` helper class will inject `ContentAgentService` and call its `generateContent()` method for each prompt with ContentType.faq_page. All 3 generations run in parallel using `Promise.allSettled()` to catch and log failures without throwing. The main Weekly Brief pipeline continues regardless of content generation success.

**Tech Stack:** NestJS, Prisma, TypeScript, Jest (testing)

---

## Task 1: Update DownstreamTrigger to accept tenantId and inject ContentAgentService

**Files:**
- Modify: `app/weekly-brief/helpers/downstream-trigger.ts:1-50`

- [ ] **Step 1: Add ContentAgentService import**

At the top of `downstream-trigger.ts`, add the import:

```typescript
import { ContentAgentService } from '../../content-agent/content-agent.service';
```

- [ ] **Step 2: Inject ContentAgentService in constructor**

Update the constructor to inject `ContentAgentService`:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly contentAgentService: ContentAgentService,
) {}
```

- [ ] **Step 3: Update method signature to accept tenantId**

Change the method signature from:

```typescript
async triggerContentDraftsForWorstPrompts(clientId: string): Promise<void> {
```

to:

```typescript
async triggerContentDraftsForWorstPrompts(clientId: string, tenantId: string): Promise<void> {
```

- [ ] **Step 4: Commit**

```bash
git add app/weekly-brief/helpers/downstream-trigger.ts
git commit -m "[TASK-009] feat: inject ContentAgentService into DownstreamTrigger and add tenantId parameter"
```

---

## Task 2: Implement the TODO with Promise.allSettled() and ContentAgentService.generateContent

**Files:**
- Modify: `app/weekly-brief/helpers/downstream-trigger.ts:22-49`

- [ ] **Step 1: Replace TODO with actual implementation**

Replace lines 41-44 (the TODO loop) with:

```typescript
      const generatePromises = worstPrompts.map(({ prompt_id }) => {
        this.logger.log(`Triggering content draft for prompt ${prompt_id} (worst performer)`);
        return this.contentAgentService.generateContent(tenantId, {
          clientId,
          contentType: 'faq_page' as const,
          targetPromptId: prompt_id,
        });
      });

      const results = await Promise.allSettled(generatePromises);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const prompt_id = worstPrompts[index].prompt_id;
          this.logger.error(
            `Failed to generate content draft for prompt ${prompt_id}: ${result.reason.message}`,
          );
        } else {
          const prompt_id = worstPrompts[index].prompt_id;
          this.logger.log(
            `Content draft generated successfully for prompt ${prompt_id}, output ID: ${result.value.id}`,
          );
        }
      });
```

The full method should now look like:

```typescript
async triggerContentDraftsForWorstPrompts(clientId: string, tenantId: string): Promise<void> {
  try {
    // Find 3 prompts with lowest citation rate in past 30 days
    const worstPrompts = await this.prisma.$queryRaw<
      Array<{ prompt_id: string; citation_rate: number }>
    >`
      SELECT
        p.id AS prompt_id,
        COUNT(CASE WHEN bm.is_client_brand = true THEN 1 END) * 1.0 / COUNT(pr.id) AS citation_rate
      FROM prompts p
      JOIN prompt_runs pr ON p.id = pr.prompt_id
      LEFT JOIN brand_mentions bm ON pr.id = bm.run_id
      WHERE p.client_id = ${clientId}
        AND pr.ran_at >= NOW() - INTERVAL '30 days'
      GROUP BY p.id
      ORDER BY citation_rate ASC
      LIMIT 3
    `;

    const generatePromises = worstPrompts.map(({ prompt_id }) => {
      this.logger.log(`Triggering content draft for prompt ${prompt_id} (worst performer)`);
      return this.contentAgentService.generateContent(tenantId, {
        clientId,
        contentType: 'faq_page' as const,
        targetPromptId: prompt_id,
      });
    });

    const results = await Promise.allSettled(generatePromises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const prompt_id = worstPrompts[index].prompt_id;
        this.logger.error(
          `Failed to generate content draft for prompt ${prompt_id}: ${result.reason.message}`,
        );
      } else {
        const prompt_id = worstPrompts[index].prompt_id;
        this.logger.log(
          `Content draft generated successfully for prompt ${prompt_id}, output ID: ${result.value.id}`,
        );
      }
    });
  } catch (err) {
    this.logger.error(`Failed to trigger content drafts: ${(err as Error).message}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/weekly-brief/helpers/downstream-trigger.ts
git commit -m "[TASK-009] feat: implement ContentAgentService.generateContent calls with Promise.allSettled()"
```

---

## Task 3: Update WeeklyBriefService caller to pass tenantId

**Files:**
- Modify: `app/weekly-brief/weekly-brief.service.ts:163`

- [ ] **Step 1: Update the method call**

On line 163, change:

```typescript
    // Step 9: Auto-generate content drafts for worst prompts
    await this.downstreamTrigger.triggerContentDraftsForWorstPrompts(clientId);
```

to:

```typescript
    // Step 9: Auto-generate content drafts for worst prompts
    await this.downstreamTrigger.triggerContentDraftsForWorstPrompts(clientId, tenantId);
```

Note: `tenantId` is already available as a parameter in `generateBriefForClient()` at line 59.

- [ ] **Step 2: Commit**

```bash
git add app/weekly-brief/weekly-brief.service.ts
git commit -m "[TASK-009] feat: pass tenantId to triggerContentDraftsForWorstPrompts()"
```

---

## Task 4: Wire ContentAgentService in WeeklyBriefModule

**Files:**
- Check: `app/weekly-brief/weekly-brief.module.ts`

- [ ] **Step 1: Verify module imports**

Read `app/weekly-brief/weekly-brief.module.ts` to check if `ContentAgentModule` is already imported.

Expected: The module should already import ContentAgentModule (since DownstreamTrigger is already in the module and needs access to ContentAgentService).

If `ContentAgentModule` is NOT imported, add it to the imports array:

```typescript
import { ContentAgentModule } from '../content-agent/content-agent.module';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    ContentAgentModule,  // Add this if missing
    // ... other imports
  ],
  providers: [
    // ... providers
  ],
})
export class WeeklyBriefModule {}
```

- [ ] **Step 2: Commit (if changes made)**

```bash
git add app/weekly-brief/weekly-brief.module.ts
git commit -m "[TASK-009] feat: import ContentAgentModule in WeeklyBriefModule"
```

---

## Task 5: Run tests to verify implementation

**Files:**
- Test: `app/weekly-brief/__tests__/weekly-brief.service.spec.ts`

- [ ] **Step 1: Run the existing test suite**

```bash
npm test -- app/weekly-brief/__tests__/weekly-brief.service.spec.ts
```

Expected: All existing tests pass (the test already mocks downstreamTrigger, so no changes needed to the test).

- [ ] **Step 2: Verify the mock behavior**

Check that the test still passes because `downstreamTrigger.triggerContentDraftsForWorstPrompts` is already mocked. The mock will accept the new tenantId parameter without issues.

- [ ] **Step 3: Run the full weekly-brief test suite**

```bash
npm test -- app/weekly-brief/__tests__/
```

Expected: All tests pass.

---

## Task 6: Verify integration and smoke test

**Files:**
- Check: Existing smoke test or manual verification

- [ ] **Step 1: Run backend in development mode**

```bash
npm run start:dev
```

Wait for the server to start on port 3000.

- [ ] **Step 2: Verify DownstreamTrigger logs**

In the running server, the logs should show (when Weekly Brief is generated):
- `Triggering content draft for prompt <prompt_id> (worst performer)` (3 times, one per worst prompt)
- Either: `Content draft generated successfully for prompt <prompt_id>, output ID: <id>` or `Failed to generate content draft for prompt <prompt_id>: <error>`

- [ ] **Step 3: Verify no pipeline breaks**

The Weekly Brief generation should complete successfully even if some content draft generations fail (no exceptions thrown, pipeline continues).

---

## Task 7: Final commit summary

- [ ] **Step 1: Check git log**

```bash
git log --oneline -5
```

Expected output should show 3 commits:
- `[TASK-009] feat: inject ContentAgentService into DownstreamTrigger and add tenantId parameter`
- `[TASK-009] feat: implement ContentAgentService.generateContent calls with Promise.allSettled()`
- `[TASK-009] feat: pass tenantId to triggerContentDraftsForWorstPrompts()`

(Optional: `[TASK-009] feat: import ContentAgentModule in WeeklyBriefModule` if it was needed)

- [ ] **Step 2: Verify the working directory is clean**

```bash
git status
```

Expected: Nothing to commit, working tree clean (except untracked files that were there before).

---

## Checklist Summary

- [ ] ContentAgentService injected into DownstreamTrigger
- [ ] tenantId parameter added to triggerContentDraftsForWorstPrompts()
- [ ] TODO implemented with Promise.allSettled()
- [ ] WeeklyBriefService caller updated to pass tenantId
- [ ] ContentAgentModule imported in WeeklyBriefModule (if needed)
- [ ] Tests pass
- [ ] Integration verified
- [ ] Commits clean and formatted
