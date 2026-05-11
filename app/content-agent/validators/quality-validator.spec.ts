import { Test, TestingModule } from '@nestjs/testing';
import { ContentType } from '@prisma/client';
import { QualityValidatorService } from './quality-validator';

// ── HTML builder helpers ──────────────────────────────────────────────────────

function ld(schema: object): string {
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

const SECONDARY_LD = ld({ '@type': 'LocalBusiness', name: 'Test Business' });

function faqPageLd(qas: Array<{ q: string; a: string }>): string {
  return ld({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qas.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });
}

function html(body: string, head = `${ld({ '@type': 'FAQPage' })}${SECONDARY_LD}`): string {
  return `<html><head>${head}</head><body><h1>Title</h1>${body}</body></html>`;
}

function faqHtml(qas: Array<{ q: string; a: string }>): string {
  return html('', `${faqPageLd(qas)}${SECONDARY_LD}`);
}

// ── Answer builders ───────────────────────────────────────────────────────────

function words(n: number, withNumber = true): string {
  // n words; last two are "5 stars" when withNumber=true so NUMBER_RE matches
  if (withNumber) {
    return 'word '.repeat(n - 2).trim() + ' 5 stars';
  }
  return 'word '.repeat(n).trim();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QualityValidatorService', () => {
  let svc: QualityValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QualityValidatorService],
    }).compile();
    svc = module.get(QualityValidatorService);
  });

  // ── Title ─────────────────────────────────────────────────────────────────

  describe('title_length', () => {
    it('flags title > 70 chars as fatal', () => {
      const result = svc.validate('A'.repeat(71), html(''));
      expect(result.issues.some((i) => i.rule === 'title_length' && i.fatal)).toBe(true);
      expect(result.valid).toBe(false);
    });

    it('accepts title of exactly 70 chars', () => {
      const result = svc.validate('A'.repeat(70), html(''));
      expect(result.issues.find((i) => i.rule === 'title_length')).toBeUndefined();
    });
  });

  // ── HTML structure ────────────────────────────────────────────────────────

  describe('html_structure', () => {
    it('flags missing structural tags as fatal', () => {
      const result = svc.validate('Title', '<div>no structure</div>');
      expect(result.issues.some((i) => i.rule === 'html_structure' && i.fatal)).toBe(true);
    });

    it('flags missing h1 as non-fatal warning', () => {
      const bare = `<html><head>${ld({ '@type': 'A' })}${SECONDARY_LD}</head><body><p>text</p></body></html>`;
      const result = svc.validate('Title', bare);
      expect(result.issues.some((i) => i.rule === 'html_no_h1' && !i.fatal)).toBe(true);
    });
  });

  // ── JSON-LD ───────────────────────────────────────────────────────────────

  describe('json_ld', () => {
    it('flags missing JSON-LD blocks as fatal', () => {
      const bare = '<html><head></head><body><h1>T</h1></body></html>';
      const result = svc.validate('Title', bare);
      expect(result.issues.some((i) => i.rule === 'json_ld_missing' && i.fatal)).toBe(true);
    });

    it('warns when only 1 JSON-LD block present (missing secondary schema)', () => {
      const oneBlock = `<html><head>${ld({ '@type': 'FAQPage' })}</head><body><h1>T</h1></body></html>`;
      const result = svc.validate('Title', oneBlock);
      expect(result.issues.some((i) => i.rule === 'secondary_schema_missing')).toBe(true);
    });

    it('flags invalid JSON inside a JSON-LD block as fatal', () => {
      const bad = `<html><head><script type="application/ld+json">{broken json</script>${SECONDARY_LD}</head><body><h1>T</h1></body></html>`;
      const result = svc.validate('Title', bad);
      expect(result.issues.some((i) => i.rule === 'json_ld_invalid' && i.fatal)).toBe(true);
    });

    it('accepts two valid JSON-LD blocks', () => {
      const result = svc.validate('Title', html(''));
      expect(result.issues.find((i) => ['json_ld_missing', 'json_ld_invalid'].includes(i.rule))).toBeUndefined();
    });
  });

  // ── FAQ answer rules — type dispatch ─────────────────────────────────────

  describe('faq_page answer rules', () => {
    it('flags answer > 90 words as fatal (threshold is 90, not 100)', () => {
      const long91 = words(91);
      const result = svc.validate('Title', faqHtml([{ q: 'Q?', a: long91 }]), ContentType.faq_page);
      expect(result.issues.some((i) => i.rule === 'answer_too_long' && i.fatal)).toBe(true);
    });

    it('accepts answer of exactly 90 words', () => {
      const exact90 = words(90);
      const result = svc.validate('Title', faqHtml([{ q: 'Q?', a: exact90 }]), ContentType.faq_page);
      expect(result.issues.find((i) => i.rule === 'answer_too_long')).toBeUndefined();
    });

    it('flags answer < 50 words as non-fatal warning', () => {
      const short = words(30);
      const result = svc.validate('Title', faqHtml([{ q: 'Q?', a: short }]), ContentType.faq_page);
      expect(result.issues.some((i) => i.rule === 'answer_too_short' && !i.fatal)).toBe(true);
    });

    it('flags answer with no number as fatal', () => {
      const noNum = 'word '.repeat(60).trim();
      const result = svc.validate('Title', faqHtml([{ q: 'Q?', a: noNum }]), ContentType.faq_page);
      expect(result.issues.some((i) => i.rule === 'answer_no_number' && i.fatal)).toBe(true);
    });

    it('does NOT apply FAQ answer rules for comparison_page type', () => {
      const tableHtml = html('<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>');
      const result = svc.validate('Title', tableHtml, ContentType.comparison_page);
      expect(result.issues.find((i) => i.rule === 'answer_too_long')).toBeUndefined();
      expect(result.issues.find((i) => i.rule === 'answer_no_number')).toBeUndefined();
    });

    it('does NOT apply FAQ answer rules for segment_article type', () => {
      const bodyText = 'word '.repeat(1300);
      const result = svc.validate('Title', html(`<p>${bodyText}</p>`), ContentType.segment_article);
      expect(result.issues.find((i) => i.rule === 'answer_too_long')).toBeUndefined();
    });
  });

  // ── Comparison page dispatch ──────────────────────────────────────────────

  describe('comparison_page checks', () => {
    it('flags missing table as fatal for comparison_page', () => {
      const result = svc.validate('Title', html('<p>no table</p>'), ContentType.comparison_page);
      expect(result.issues.some((i) => i.rule === 'comparison_no_table' && i.fatal)).toBe(true);
    });

    it('warns when table exists but thead is missing', () => {
      const noThead = html('<table><tbody><tr><td>A</td></tr></tbody></table>');
      const result = svc.validate('Title', noThead, ContentType.comparison_page);
      expect(result.issues.some((i) => i.rule === 'comparison_table_no_thead' && !i.fatal)).toBe(true);
    });

    it('does NOT check comparison table for faq_page type', () => {
      const result = svc.validate('Title', faqHtml([{ q: 'Q?', a: words(60) }]), ContentType.faq_page);
      expect(result.issues.find((i) => i.rule === 'comparison_no_table')).toBeUndefined();
    });
  });

  // ── Segment article dispatch ──────────────────────────────────────────────

  describe('segment_article checks', () => {
    it('flags body under 1200 words as fatal', () => {
      const result = svc.validate('Title', html('<p>' + 'word '.repeat(100) + '</p>'), ContentType.segment_article);
      expect(result.issues.some((i) => i.rule === 'article_too_short' && i.fatal)).toBe(true);
    });

    it('warns when body exceeds 1800 words', () => {
      const result = svc.validate('Title', html('<p>' + 'word '.repeat(1900) + '</p>'), ContentType.segment_article);
      expect(result.issues.some((i) => i.rule === 'article_too_long' && !i.fatal)).toBe(true);
    });

    it('warns when fewer than 2 h2 headings present', () => {
      const result = svc.validate('Title', html('<h2>Only one</h2><p>' + 'word '.repeat(1300) + '</p>'), ContentType.segment_article);
      expect(result.issues.some((i) => i.rule === 'article_insufficient_headings')).toBe(true);
    });

    it('does NOT check word count for faq_page type', () => {
      const result = svc.validate('Title', faqHtml([{ q: 'Q?', a: words(60) }]), ContentType.faq_page);
      expect(result.issues.find((i) => i.rule === 'article_too_short')).toBeUndefined();
    });
  });

  // ── Blocked phrases ───────────────────────────────────────────────────────

  describe('blocked_phrases', () => {
    it('flags blocked phrase as non-fatal warning', () => {
      const result = svc.validate('Title', html('<p>We are best in class</p>'));
      expect(result.issues.some((i) => i.rule === 'blocked_phrase' && !i.fatal)).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('flags multiple blocked phrases', () => {
      const result = svc.validate('Title', html('<p>industry-leading seamlessly synergy</p>'));
      const blocked = result.issues.filter((i) => i.rule === 'blocked_phrase');
      expect(blocked.length).toBe(3);
    });

    it('does not flag clean content', () => {
      const result = svc.validate('Title', html('<p>Rated 4.8 out of 5 by 2300 customers</p>'));
      expect(result.issues.find((i) => i.rule === 'blocked_phrase')).toBeUndefined();
    });
  });

  // ── answer_indirect_opening ───────────────────────────────────────────────────────────

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

  // ── howto_schema_missing ──────────────────────────────────────────────────────────

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

  // ── bare_superlative ──────────────────────────────────────────────────────────────

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

    it('flags standalone "#1" as non-fatal warning', () => {
      const result = svc.validate('Title', html('<p>We are #1 in customer satisfaction.</p>'));
      expect(result.issues.some((i) => i.rule === 'bare_superlative' && !i.fatal)).toBe(true);
    });

    it('does not flag "product#1" code (word boundary respected)', () => {
      const result = svc.validate('Title', html('<p>Order product#1 for ₹2,500 with 4.7/5 rating.</p>'));
      expect(result.issues.find((i) => i.rule === 'bare_superlative')).toBeUndefined();
    });
  });

  // ── formatIssuesSummary ───────────────────────────────────────────────────

  describe('formatIssuesSummary', () => {
    it('formats fatal issues with FAIL prefix', () => {
      const issues = [{ rule: 'title_length', message: 'too long', fatal: true }];
      expect(svc.formatIssuesSummary(issues)).toContain('[FAIL]');
    });

    it('formats non-fatal issues with WARN prefix', () => {
      const issues = [{ rule: 'blocked_phrase', message: 'found phrase', fatal: false }];
      expect(svc.formatIssuesSummary(issues)).toContain('[WARN]');
    });

    it('returns empty string for empty issues array', () => {
      expect(svc.formatIssuesSummary([])).toBe('');
    });
  });
});
