# Phase 7 Validation Gaps: Design Spec

**Date:** 2026-05-11
**Scope:** `app/content-agent/validators/quality-validator.ts` + its spec
**Status:** Approved for implementation

## Context

`QualityValidatorService` validates generated AEO content via a `validate(title, htmlContent, contentType?)` method with private type-dispatched check methods. Phase 7 audit (commit 11d2fa09) left 4 prompt-level-only rules without corresponding validator checks (Gap 4).

## Gap Summary

| # | Rule ID | Gate | Fatal |
|---|---------|------|-------|
| 1 | `answer_indirect_opening` | `faq_page` | false |
| 2 | `bare_superlative` | global | false |
| 3 | `howto_schema_missing` | `segment_article` | false |
| 4 | `wikidata_facts_missing` | `entity_authority_page` | true |

---

## Rule 1: `answer_indirect_opening` (faq_page, non-fatal)

**Trigger:** FAQ answer's first sentence begins with a filler opener instead of a direct factual statement.

**Logic:**
1. For each `FaqAnswer`, extract first sentence (text up to first `.`, `?`, or `!`).
2. Lowercase + trim the first sentence.
3. Match against `FILLER_OPENERS` using `new RegExp('^<escaped-opener>(?:[^a-z]|$)', 'i')`.
4. Emit non-fatal issue on first match; `break` to avoid duplicate issues per answer.

**FILLER_OPENERS constant:**
```
"great question", "that's a great question", "of course", "absolutely", "certainly",
"sure", "i'm glad", "it depends", "well,", "as we know", "in today's", "as you may know",
"believe it or not", "there are many", "typically", "usually", "in general"
```

**Severity:** non-fatal — heuristic check, false positives possible on edge phrases.

---

## Rule 2: `bare_superlative` (global, non-fatal)

**Trigger:** Stripped plain text contains a bare unsupported superlative.

**Logic:**
1. Strip HTML tags from content via existing `stripTags()`.
2. Iterate `BARE_SUPERLATIVES` array of `{ pattern: RegExp, suggestion: string }`.
3. Use `pattern.exec(plainText)` — match text used verbatim in the issue message.
4. One issue emitted per matched superlative pattern.

**Distinct from `blocked_phrase`:** compound marketing phrases (existing list). `bare_superlative` covers bare single-word / simple-phrase superlatives without supporting data.

**BARE_SUPERLATIVES patterns:**
```
/\bbest\b/i, /\bfastest\b/i, /\bcheapest\b/i, /\blowest prices?\b/i,
/\bmost affordable\b/i, /\bmost reliable\b/i, /\bmost popular\b/i,
/\bnumber one\b/i, /#1\b/, /\bunmatched\b/i, /\bunbeatable\b/i, /\bsecond to none\b/i
```

**Severity:** non-fatal — advisory. Both `blocked_phrase` and `bare_superlative` can fire on the same content without deduplication (by design).

---

## Rule 3: `howto_schema_missing` (segment_article, non-fatal)

**Trigger:** Segment article lacks a JSON-LD block with `@type` of `HowTo`, `Article`, or `BlogPosting`.

**Logic:**
1. Extract all JSON-LD `<script>` blocks using the same regex as `checkJsonLdBlocks`.
2. Parse each block; check `schema['@type']` against `Set{HowTo, Article, BlogPosting}`.
3. Support both string `@type` and array `@type`.
4. Silently skip blocks that fail to parse (already flagged by `checkJsonLdBlocks`).
5. Emit non-fatal issue if no accepted type found.

**Accepted `@type` values:** `HowTo`, `Article`, `BlogPosting`

**Severity:** non-fatal — guidance, not a hard fail. `BlogPosting` accepted to reduce false positives on generic instructional content.

---

## Rule 4: `wikidata_facts_missing` (entity_authority_page, fatal)

**Trigger:** Entity authority page lacks a structured facts block.

**Logic:**
1. Check HTML for `<table` (any table element).
2. Check HTML for `<dl` + `<dt` (definition list with terms).
3. Emit fatal issue if neither present.

**Structural facts evidence:** `<table>` OR (`<dl>` AND `<dt>`) in the HTML body.

**Severity:** fatal — structured entity facts are the core purpose of this page type.

---

## Dispatch Additions to `validate()`

```
faq_page block:               + this.checkFirstSentence(answers, issues)
segment_article block:        + this.checkHowToSchemaType(htmlContent, issues)
NEW entity_authority_page:      this.checkWikidataFactsBlock(htmlContent, issues)
After checkBlockedPhrases:    + this.checkBareSuperlatives(htmlContent, issues)
```

---

## Backward Compatibility

- `validate()` signature unchanged.
- All 4 rules are additive; no existing rule logic modified.
- `checkBareSuperlatives` is global, but existing test content avoids lone superlative words (the one test using "best in class" only asserts `blocked_phrase` fires — no assertion that `bare_superlative` is absent).
- All 27 existing tests pass as-is.

## Test Plan

- 4 tests per rule = 16 new tests + 1 multi-rule interaction test = **17 new tests**.
- Each rule: trigger (fires), clean pass (doesn't fire), boundary/edge case, type-gate isolation.
- Multi-rule test: `blocked_phrase` + `bare_superlative` both fire on same content; `result.valid` remains true (both non-fatal).
- All added to existing `quality-validator.spec.ts`.
