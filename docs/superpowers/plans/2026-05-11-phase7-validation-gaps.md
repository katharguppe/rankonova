# Phase 7 Validation Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 missing validator rules to `QualityValidatorService` that close Phase 7 audit gaps: first-sentence validation, bare superlative detection, HowTo schema type assertion, and Wikidata facts block check.

**Architecture:** All 4 rules extend the existing private-method + type-dispatch pattern. Two new module-level constant arrays (`FILLER_OPENERS`, `BARE_SUPERLATIVES`) are added after `BLOCKED_PHRASES`. No public API changes; all rules are additive.

**Tech Stack:** TypeScript 5.x, NestJS, Jest + ts-jest, `@nestjs/testing`

---

## File Map

| File | Action |
|------|--------|
| `app/content-agent/validators/quality-validator.ts` | Add 2 constants + 4 private methods + 4 dispatch calls |
| `app/content-agent/validators/quality-validator.spec.ts` | Add 5 describe blocks, 17 new tests |

---

### Task 1: `answer_indirect_opening` — first-sentence filler detection for faq_page

**Files:**
- Modify: `app/content-agent/validators/quality-validator.ts`
- Modify: `app/content-agent/validators/quality-validator.spec.ts`

- [ ] **Step 1: Write failing tests**

  In `quality-validator.spec.ts`, add after the `blocked_phrases` describe block (after the closing `});` around line 215):

  ```typescript
  // ── answer_indirect_opening ───────────────────────────────────────────────────

  describe('answer_indirect_opening', () => {
    it('flags "Of course" opener as non-fatal warning', () => {
      const answer = 'Of course, the service costs ₹5,000 per month and covers 10 devices.';
      const result = svc.validate('Title', faqHtml([{ q: 'What does it cost?', a: answer }]), ContentType.faq_page);
      expect(result.issues.some((i) => i.rule === 'answer_indirect_opening' && !i.fatal)).toBe(true);
    });

    it('flags "Typically" opener as non-fatal warning', () => {
      const answer = 'Typically, service takes 3 days and costs ₹2,000 for a standard 5-star package.';
      const result = svc.validate('Title', faqHtml([{ q: 'How long does service take?', a: answer }]), ContentType.faq_page);
      expect(result.issues.some((i) => i.rule === 'answer_indirect_opening' && !i.fatal)).toBe(true);
    });

    it('accepts answer opening with a direct factual statement', () => {
      const answer = 'The Toyota Camry starts at ₹38 lakh ex-showroom and scores 5 stars in safety.';
      const result = svc.validate('Title', faqHtml([{ q: 'What is the price?', a: answer }]), ContentType.faq_page);
      expect(result.issues.find((i) => i.rule === 'answer_indirect_opening')).toBeUndefined();
    });

    it('does NOT apply to comparison_page type', () => {
      const tableHtml = html('<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>');
      const result = svc.validate('Title', tableHtml, ContentType.comparison_page);
      expect(result.issues.find((i) => i.rule === 'answer_indirect_opening')).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run tests — verify 4 new tests FAIL**

  ```bash
  npx jest --testPathPattern="quality-validator.spec" --no-coverage --forceExit
  ```

  Expected: 27 PASS, 4 FAIL (rule not yet implemented).

- [ ] **Step 3: Add FILLER_OPENERS constant to quality-validator.ts**

  In `quality-validator.ts`, after the closing `];` of `BLOCKED_PHRASES` (after line 24) and before the blank line, insert:

  ```typescript
  const FILLER_OPENERS: string[] = [
    'great question',
    "that's a great question",
    'of course',
    'absolutely',
    'certainly',
    'sure',
    "i'm glad",
    'it depends',
    'well,',
    'as we know',
    "in today's",
    'as you may know',
    'believe it or not',
    'there are many',
    'typically',
    'usually',
    'in general',
  ];
  ```

- [ ] **Step 4: Add checkFirstSentence dispatch call in validate()**

  In `quality-validator.ts`, change the `faq_page` dispatch block:

  ```typescript
      if (contentType === ContentType.faq_page) {
        const answers = this.extractFaqAnswers(htmlContent);
        if (answers.length > 0) {
          this.checkAnswerRules(answers, issues);
        }
      }
  ```

  To:

  ```typescript
      if (contentType === ContentType.faq_page) {
        const answers = this.extractFaqAnswers(htmlContent);
        if (answers.length > 0) {
          this.checkAnswerRules(answers, issues);
          this.checkFirstSentence(answers, issues);
        }
      }
  ```

- [ ] **Step 5: Add checkFirstSentence private method**

  In `quality-validator.ts`, add this method directly before the `private stripTags` method (at the very end of the class):

  ```typescript
    private checkFirstSentence(answers: FaqAnswer[], issues: ValidationIssue[]): void {
      for (let i = 0; i < answers.length; i++) {
        const a = answers[i];
        const label = `Answer ${i + 1} ("${a.question.slice(0, 50)}${a.question.length > 50 ? '…' : ''}")`;
        const firstSentenceMatch = a.plainText.match(/^[^.!?]+[.!?]?/);
        if (!firstSentenceMatch) continue;
        const normalised = firstSentenceMatch[0].toLowerCase().trim();
        for (const opener of FILLER_OPENERS) {
          const escaped = opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`^${escaped}(?:[^a-z]|$)`, 'i').test(normalised)) {
            issues.push({
              rule: 'answer_indirect_opening',
              message: `${label} opens with filler phrase "${firstSentenceMatch[0].trim()}"`,
              suggestion: 'Open with a direct, factual answer to the question',
              fatal: false,
            });
            break;
          }
        }
      }
    }
  ```

- [ ] **Step 6: Run tests — verify all 31 pass**

  ```bash
  npx jest --testPathPattern="quality-validator.spec" --no-coverage --forceExit
  ```

  Expected: 31 PASS (27 existing + 4 new). Zero failures.

- [ ] **Step 7: Commit**

  ```bash
  git add app/content-agent/validators/quality-validator.ts app/content-agent/validators/quality-validator.spec.ts
  git commit -m "[TASK-007] feat: add answer_indirect_opening validation rule"
  ```

---

### Task 2: `bare_superlative` — bare unsupported superlative detection (global)

**Files:**
- Modify: `app/content-agent/validators/quality-validator.ts`
- Modify: `app/content-agent/validators/quality-validator.spec.ts`

- [ ] **Step 1: Write failing tests**

  In `quality-validator.spec.ts`, add after the `answer_indirect_opening` describe block:

  ```typescript
  // ── bare_superlative ──────────────────────────────────────────────────────────

  describe('bare_superlative', () => {
    it('flags bare "best" as non-fatal warning', () => {
      const result = svc.validate('Title', html('<p>We offer the best service in Bangalore.</p>'));
      expect(result.issues.some((i) => i.rule === 'bare_superlative' && !i.fatal)).toBe(true);
    });

    it('flags bare "fastest" as non-fatal warning', () => {
      const result = svc.validate('Title', html('<p>Our delivery is the fastest option available.</p>'));
      expect(result.issues.some((i) => i.rule === 'bare_superlative' && !i.fatal)).toBe(true);
    });

    it('does not flag "bestseller" (word boundary respected)', () => {
      const result = svc.validate('Title', html('<p>Our bestseller model ships in 2 days for ₹1,500.</p>'));
      expect(result.issues.find((i) => i.rule === 'bare_superlative')).toBeUndefined();
    });

    it('does not flag content with no superlatives', () => {
      const result = svc.validate('Title', html('<p>Rated 4.8/5 by 2,300 customers since 2019.</p>'));
      expect(result.issues.find((i) => i.rule === 'bare_superlative')).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run tests — verify 4 new tests FAIL**

  ```bash
  npx jest --testPathPattern="quality-validator.spec" --no-coverage --forceExit
  ```

  Expected: 31 PASS, 4 FAIL.

- [ ] **Step 3: Add BARE_SUPERLATIVES constant**

  In `quality-validator.ts`, after the closing `];` of `FILLER_OPENERS`, insert:

  ```typescript
  const BARE_SUPERLATIVES: Array<{ pattern: RegExp; suggestion: string }> = [
    { pattern: /\bbest\b/i, suggestion: 'replace "best" with a specific ranked claim, e.g. "rated #1 by 3,000 customers"' },
    { pattern: /\bfastest\b/i, suggestion: 'replace "fastest" with a measured time, e.g. "delivers in 2 hours"' },
    { pattern: /\bcheapest\b/i, suggestion: 'replace "cheapest" with a specific price, e.g. "starting at ₹999"' },
    { pattern: /\blowest prices?\b/i, suggestion: 'replace with an actual price range or price guarantee' },
    { pattern: /\bmost affordable\b/i, suggestion: 'replace with a specific price claim, e.g. "starting at ₹X"' },
    { pattern: /\bmost reliable\b/i, suggestion: 'replace with reliability data, e.g. "99.9% uptime"' },
    { pattern: /\bmost popular\b/i, suggestion: 'replace with a count, e.g. "chosen by 10,000+ customers"' },
    { pattern: /\bnumber one\b/i, suggestion: 'cite the source or replace with a specific metric' },
    { pattern: /#1\b/, suggestion: 'cite the source or replace with a specific metric' },
    { pattern: /\bunmatched\b/i, suggestion: 'remove or replace with a specific differentiator' },
    { pattern: /\bunbeatable\b/i, suggestion: 'remove or replace with a specific price or quality claim' },
    { pattern: /\bsecond to none\b/i, suggestion: 'remove or replace with a measurable claim' },
  ];
  ```

- [ ] **Step 4: Add checkBareSuperlatives dispatch call in validate()**

  In `quality-validator.ts`, change:

  ```typescript
      this.checkBlockedPhrases(htmlContent, issues);

      return {
  ```

  To:

  ```typescript
      this.checkBlockedPhrases(htmlContent, issues);
      this.checkBareSuperlatives(htmlContent, issues);

      return {
  ```

- [ ] **Step 5: Add checkBareSuperlatives private method**

  In `quality-validator.ts`, add directly before `checkFirstSentence`:

  ```typescript
    private checkBareSuperlatives(html: string, issues: ValidationIssue[]): void {
      const plainText = this.stripTags(html);
      for (const { pattern, suggestion } of BARE_SUPERLATIVES) {
        const match = pattern.exec(plainText);
        if (match) {
          issues.push({
            rule: 'bare_superlative',
            message: `Unsupported superlative detected: "${match[0]}"`,
            suggestion,
            fatal: false,
          });
        }
      }
    }
  ```

- [ ] **Step 6: Run tests — verify all 35 pass**

  ```bash
  npx jest --testPathPattern="quality-validator.spec" --no-coverage --forceExit
  ```

  Expected: 35 PASS. Zero failures.

- [ ] **Step 7: Commit**

  ```bash
  git add app/content-agent/validators/quality-validator.ts app/content-agent/validators/quality-validator.spec.ts
  git commit -m "[TASK-007] feat: add bare_superlative validation rule"
  ```

---

### Task 3: `howto_schema_missing` — schema type assertion for segment_article

**Files:**
- Modify: `app/content-agent/validators/quality-validator.ts`
- Modify: `app/content-agent/validators/quality-validator.spec.ts`

- [ ] **Step 1: Write failing tests**

  In `quality-validator.spec.ts`, add after the `bare_superlative` describe block:

  ```typescript
  // ── howto_schema_missing ──────────────────────────────────────────────────────

  describe('howto_schema_missing', () => {
    it('passes when segment article has HowTo JSON-LD', () => {
      const h = html('', `${ld({ '@type': 'HowTo', name: 'How To Service Your Car' })}${SECONDARY_LD}`);
      const result = svc.validate('Title', h, ContentType.segment_article);
      expect(result.issues.find((i) => i.rule === 'howto_schema_missing')).toBeUndefined();
    });

    it('passes when segment article has Article JSON-LD', () => {
      const h = html('', `${ld({ '@type': 'Article', name: 'Car Maintenance Guide' })}${SECONDARY_LD}`);
      const result = svc.validate('Title', h, ContentType.segment_article);
      expect(result.issues.find((i) => i.rule === 'howto_schema_missing')).toBeUndefined();
    });

    it('passes when segment article has BlogPosting JSON-LD', () => {
      const h = html('', `${ld({ '@type': 'BlogPosting', name: 'Guide to Car Care' })}${SECONDARY_LD}`);
      const result = svc.validate('Title', h, ContentType.segment_article);
      expect(result.issues.find((i) => i.rule === 'howto_schema_missing')).toBeUndefined();
    });

    it('warns when segment article has no HowTo/Article/BlogPosting schema', () => {
      const h = html('', `${ld({ '@type': 'LocalBusiness', name: 'My Business' })}${SECONDARY_LD}`);
      const result = svc.validate('Title', h, ContentType.segment_article);
      expect(result.issues.some((i) => i.rule === 'howto_schema_missing' && !i.fatal)).toBe(true);
    });

    it('does NOT apply to faq_page type', () => {
      const result = svc.validate('Title', faqHtml([{ q: 'Q?', a: words(60) }]), ContentType.faq_page);
      expect(result.issues.find((i) => i.rule === 'howto_schema_missing')).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run tests — verify 5 new tests FAIL**

  ```bash
  npx jest --testPathPattern="quality-validator.spec" --no-coverage --forceExit
  ```

  Expected: 35 PASS, 5 FAIL.

- [ ] **Step 3: Add checkHowToSchemaType dispatch call in validate()**

  In `quality-validator.ts`, change the `segment_article` block:

  ```typescript
      if (contentType === ContentType.segment_article) {
        this.checkSegmentArticleWordCount(htmlContent, issues);
        this.checkSegmentArticleHeadings(htmlContent, issues);
      }
  ```

  To:

  ```typescript
      if (contentType === ContentType.segment_article) {
        this.checkSegmentArticleWordCount(htmlContent, issues);
        this.checkSegmentArticleHeadings(htmlContent, issues);
        this.checkHowToSchemaType(htmlContent, issues);
      }
  ```

- [ ] **Step 4: Add checkHowToSchemaType private method**

  In `quality-validator.ts`, add directly before `checkBareSuperlatives`:

  ```typescript
    private checkHowToSchemaType(html: string, issues: ValidationIssue[]): void {
      const ACCEPTED_TYPES = new Set(['HowTo', 'Article', 'BlogPosting']);
      const scriptMatches = [
        ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
      ];
      const hasAcceptedType = scriptMatches.some(([, block]) => {
        try {
          const schema = JSON.parse(block) as Record<string, unknown>;
          const type = schema['@type'];
          if (typeof type === 'string') return ACCEPTED_TYPES.has(type);
          if (Array.isArray(type)) return (type as string[]).some((t) => ACCEPTED_TYPES.has(t));
          return false;
        } catch {
          return false;
        }
      });
      if (!hasAcceptedType) {
        issues.push({
          rule: 'howto_schema_missing',
          message: 'Segment article lacks a HowTo, Article, or BlogPosting JSON-LD block',
          suggestion: 'Add a JSON-LD block with "@type": "HowTo" or "@type": "Article"',
          fatal: false,
        });
      }
    }
  ```

- [ ] **Step 5: Run tests — verify all 40 pass**

  ```bash
  npx jest --testPathPattern="quality-validator.spec" --no-coverage --forceExit
  ```

  Expected: 40 PASS. Zero failures.

- [ ] **Step 6: Commit**

  ```bash
  git add app/content-agent/validators/quality-validator.ts app/content-agent/validators/quality-validator.spec.ts
  git commit -m "[TASK-007] feat: add howto_schema_missing validation rule for segment_article"
  ```

---

### Task 4: `wikidata_facts_missing` — structured facts block for entity_authority_page

**Files:**
- Modify: `app/content-agent/validators/quality-validator.ts`
- Modify: `app/content-agent/validators/quality-validator.spec.ts`

- [ ] **Step 1: Write failing tests**

  In `quality-validator.spec.ts`, add after the `howto_schema_missing` describe block:

  ```typescript
  // ── wikidata_facts_missing ────────────────────────────────────────────────────

  describe('wikidata_facts_missing', () => {
    it('passes when entity page has a <table>', () => {
      const h = html('<table><tr><th>Founded</th><td>1998</td></tr></table>');
      const result = svc.validate('Title', h, ContentType.entity_authority_page);
      expect(result.issues.find((i) => i.rule === 'wikidata_facts_missing')).toBeUndefined();
    });

    it('passes when entity page has a <dl> with <dt>', () => {
      const h = html('<dl><dt>Founded</dt><dd>1998</dd><dt>CEO</dt><dd>Jane Smith</dd></dl>');
      const result = svc.validate('Title', h, ContentType.entity_authority_page);
      expect(result.issues.find((i) => i.rule === 'wikidata_facts_missing')).toBeUndefined();
    });

    it('flags missing facts block as fatal for entity_authority_page', () => {
      const h = html('<p>This page describes the entity.</p>');
      const result = svc.validate('Title', h, ContentType.entity_authority_page);
      expect(result.issues.some((i) => i.rule === 'wikidata_facts_missing' && i.fatal)).toBe(true);
      expect(result.valid).toBe(false);
    });

    it('does NOT apply to faq_page type', () => {
      const result = svc.validate('Title', faqHtml([{ q: 'Q?', a: words(60) }]), ContentType.faq_page);
      expect(result.issues.find((i) => i.rule === 'wikidata_facts_missing')).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run tests — verify 4 new tests FAIL**

  ```bash
  npx jest --testPathPattern="quality-validator.spec" --no-coverage --forceExit
  ```

  Expected: 40 PASS, 4 FAIL.

- [ ] **Step 3: Add entity_authority_page dispatch block in validate()**

  In `quality-validator.ts`, change the code after the `segment_article` block:

  ```typescript
      if (contentType === ContentType.segment_article) {
        this.checkSegmentArticleWordCount(htmlContent, issues);
        this.checkSegmentArticleHeadings(htmlContent, issues);
        this.checkHowToSchemaType(htmlContent, issues);
      }

      this.checkBlockedPhrases(htmlContent, issues);
  ```

  To:

  ```typescript
      if (contentType === ContentType.segment_article) {
        this.checkSegmentArticleWordCount(htmlContent, issues);
        this.checkSegmentArticleHeadings(htmlContent, issues);
        this.checkHowToSchemaType(htmlContent, issues);
      }

      if (contentType === ContentType.entity_authority_page) {
        this.checkWikidataFactsBlock(htmlContent, issues);
      }

      this.checkBlockedPhrases(htmlContent, issues);
  ```

- [ ] **Step 4: Add checkWikidataFactsBlock private method**

  In `quality-validator.ts`, add directly before `checkHowToSchemaType`:

  ```typescript
    private checkWikidataFactsBlock(html: string, issues: ValidationIssue[]): void {
      const hasTable = /<table[\s>]/i.test(html);
      const hasDl = /<dl[\s>]/i.test(html) && /<dt[\s>]/i.test(html);
      if (!hasTable && !hasDl) {
        issues.push({
          rule: 'wikidata_facts_missing',
          message: 'Entity authority page lacks a structured facts block (<table> or <dl>/<dt>)',
          suggestion: 'Add a facts table or definition list with entity properties (founding date, location, CEO, etc.)',
          fatal: true,
        });
      }
    }
  ```

- [ ] **Step 5: Run tests — verify all 44 pass**

  ```bash
  npx jest --testPathPattern="quality-validator.spec" --no-coverage --forceExit
  ```

  Expected: 44 PASS. Zero failures.

- [ ] **Step 6: Commit**

  ```bash
  git add app/content-agent/validators/quality-validator.ts app/content-agent/validators/quality-validator.spec.ts
  git commit -m "[TASK-007] feat: add wikidata_facts_missing validation rule for entity_authority_page"
  ```

---

### Task 5: Multi-rule interaction test + full suite verification

**Files:**
- Modify: `app/content-agent/validators/quality-validator.spec.ts`

- [ ] **Step 1: Add multi-rule interaction test**

  In `quality-validator.spec.ts`, add after the `wikidata_facts_missing` describe block:

  ```typescript
  // ── multi-rule interaction ────────────────────────────────────────────────────

  describe('multi-rule interaction', () => {
    it('fires blocked_phrase and bare_superlative together without deduplication', () => {
      const result = svc.validate('Title', html('<p>We are the best and truly industry-leading provider.</p>'));
      const blocked = result.issues.filter((i) => i.rule === 'blocked_phrase');
      const superlative = result.issues.filter((i) => i.rule === 'bare_superlative');
      expect(blocked.length).toBeGreaterThanOrEqual(1);
      expect(superlative.length).toBeGreaterThanOrEqual(1);
      expect(result.valid).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run quality-validator suite — verify all 45 pass**

  ```bash
  npx jest --testPathPattern="quality-validator.spec" --no-coverage --forceExit
  ```

  Expected: 45 PASS. Zero failures.

- [ ] **Step 3: Run full project test suite — verify no regressions**

  ```bash
  npx jest --no-coverage --forceExit
  ```

  Expected: all tests green. Confirm total count matches pre-implementation baseline (105+). Zero new failures.

- [ ] **Step 4: Commit**

  ```bash
  git add app/content-agent/validators/quality-validator.spec.ts
  git commit -m "[TASK-007] test: add multi-rule interaction spec for bare_superlative + blocked_phrase"
  ```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 4 gap rules covered (Tasks 1–4). Multi-rule interaction test in Task 5.
- [x] **No placeholders:** Every step contains exact code or commands.
- [x] **Type consistency:** `FaqAnswer` used correctly in `checkFirstSentence`. `ValidationIssue` shape matches existing interface. `BARE_SUPERLATIVES` type `Array<{ pattern: RegExp; suggestion: string }>` used in both constant definition and method body.
- [x] **Method order:** Methods added in Tasks 4 → 3 → 2 → 1 order (each added "before" the previously added method), producing final order: `checkWikidataFactsBlock` → `checkHowToSchemaType` → `checkBareSuperlatives` → `checkFirstSentence` → `stripTags`.
- [x] **Backward compat:** `bare_superlative` is global; existing test `html('<p>We are best in class</p>')` will also trigger `bare_superlative`, but that test only asserts `blocked_phrase` fires — no assertion that `bare_superlative` is absent.
