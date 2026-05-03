import { Injectable } from '@nestjs/common';
import { ValidationIssue, ValidationResult } from '../content-agent.types';

interface FaqAnswer {
  question: string;
  plainText: string;
  wordCount: number;
  hasNumber: boolean;
}

const BLOCKED_PHRASES: Array<{ phrase: string; suggestion: string }> = [
  { phrase: 'best in class', suggestion: 'replace with a specific metric, e.g. "rated 4.8/5 by 2,300 customers"' },
  { phrase: 'industry-leading', suggestion: 'replace with a specific measurable claim' },
  { phrase: 'world-class', suggestion: 'remove or replace with a specific metric' },
  { phrase: 'cutting-edge', suggestion: 'describe the specific feature instead' },
  { phrase: 'state-of-the-art', suggestion: 'describe the specific capability instead' },
  { phrase: 'seamlessly', suggestion: 'use a concrete operational description instead' },
  { phrase: 'game-changer', suggestion: 'describe the specific impact with data' },
  { phrase: 'revolutionary', suggestion: 'remove or replace with a specific innovation claim' },
  { phrase: 'synergy', suggestion: 'remove or replace with a concrete outcome' },
  { phrase: 'leverage', suggestion: 'use "use" or describe the specific action' },
  { phrase: 'paradigm shift', suggestion: 'describe the specific change with data' },
];

// Matches Indian-context numbers: digits with optional units (%, INR, Rs, ₹, lakh, crore, km, sq ft, /5, +, k)
const NUMBER_RE =
  /\b\d[\d,]*(?:\.\d+)?\s*(?:%|INR|Rs\.?|₹|km|sq\.?\s*f[t.]?|lakh|crore|years?|months?|days?|hours?|k|\+|\/5|\/10|stars?)?\b/i;

@Injectable()
export class QualityValidatorService {
  validate(title: string, htmlContent: string): ValidationResult {
    const issues: ValidationIssue[] = [];

    this.checkTitle(title, issues);
    this.checkHtmlStructure(htmlContent, issues);
    this.checkJsonLdBlocks(htmlContent, issues);

    const answers = this.extractFaqAnswers(htmlContent);
    if (answers.length > 0) {
      this.checkAnswerRules(answers, issues);
    }

    this.checkBlockedPhrases(htmlContent, issues);

    return {
      valid: !issues.some((i) => i.fatal),
      issues,
    };
  }

  formatIssuesSummary(issues: ValidationIssue[]): string {
    if (issues.length === 0) return '';
    return issues
      .map((i) => `[${i.fatal ? 'FAIL' : 'WARN'}] ${i.rule}: ${i.message}`)
      .join('\n');
  }

  // ── private checks ────────────────────────────────────────────────────────────

  private checkTitle(title: string, issues: ValidationIssue[]): void {
    if (title.length > 70) {
      issues.push({
        rule: 'title_length',
        message: `Title is ${title.length} chars (max 70): "${title}"`,
        suggestion: 'Shorten to 70 characters or fewer',
        fatal: true,
      });
    }
  }

  private checkHtmlStructure(html: string, issues: ValidationIssue[]): void {
    const required = ['<html', '</html>', '<head', '</head>', '<body', '</body>'];
    const missing = required.filter((t) => !html.toLowerCase().includes(t.toLowerCase()));
    if (missing.length > 0) {
      issues.push({
        rule: 'html_structure',
        message: `HTML missing structural tag(s): ${missing.join(', ')}`,
        fatal: true,
      });
    }

    if (!html.toLowerCase().includes('<h1')) {
      issues.push({
        rule: 'html_no_h1',
        message: 'Page has no <h1> tag',
        suggestion: 'Add an <h1> matching the page title',
        fatal: false,
      });
    }
  }

  private checkJsonLdBlocks(html: string, issues: ValidationIssue[]): void {
    const scriptMatches = [
      ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ];

    if (scriptMatches.length === 0) {
      issues.push({
        rule: 'json_ld_missing',
        message: 'No JSON-LD <script> blocks found',
        suggestion: 'Add a FAQPage JSON-LD block in the <head>',
        fatal: true,
      });
      return;
    }

    if (scriptMatches.length < 2) {
      issues.push({
        rule: 'secondary_schema_missing',
        message: 'Only 1 JSON-LD block found; expected 2 (FAQPage + secondary vertical schema)',
        suggestion: 'Add a LocalBusiness or vertical-specific secondary schema',
        fatal: false,
      });
    }

    for (const [, block] of scriptMatches) {
      try {
        JSON.parse(block);
      } catch (err) {
        issues.push({
          rule: 'json_ld_invalid',
          message: `JSON-LD block failed to parse: ${(err as SyntaxError).message}`,
          suggestion: 'Ensure the JSON-LD block contains valid JSON',
          fatal: true,
        });
      }
    }
  }

  private extractFaqAnswers(html: string): FaqAnswer[] {
    const scriptMatches = [
      ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ];

    for (const [, block] of scriptMatches) {
      let schema: unknown;
      try {
        schema = JSON.parse(block);
      } catch {
        continue;
      }

      if (
        typeof schema !== 'object' ||
        schema === null ||
        (schema as Record<string, unknown>)['@type'] !== 'FAQPage'
      ) {
        continue;
      }

      const entities = (schema as Record<string, unknown>)['mainEntity'];
      if (!Array.isArray(entities)) continue;

      return entities
        .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .map((e) => {
          const question = String((e['name'] as string | undefined) ?? '');
          const answer = e['acceptedAnswer'] as Record<string, unknown> | undefined;
          const rawText = String((answer?.['text'] as string | undefined) ?? '');
          const plainText = this.stripTags(rawText);
          const words = plainText.trim().split(/\s+/).filter(Boolean);
          return {
            question,
            plainText,
            wordCount: words.length,
            hasNumber: NUMBER_RE.test(plainText),
          };
        });
    }

    return [];
  }

  private checkAnswerRules(answers: FaqAnswer[], issues: ValidationIssue[]): void {
    for (let i = 0; i < answers.length; i++) {
      const a = answers[i];
      const label = `Answer ${i + 1} ("${a.question.slice(0, 50)}${a.question.length > 50 ? '…' : ''}")`;

      if (a.wordCount > 100) {
        issues.push({
          rule: 'answer_too_long',
          message: `${label} has ${a.wordCount} words (max 90)`,
          suggestion: 'Trim to 90 words or fewer',
          fatal: true,
        });
      } else if (a.wordCount < 50) {
        issues.push({
          rule: 'answer_too_short',
          message: `${label} has only ${a.wordCount} words (min 50)`,
          suggestion: 'Expand to at least 50 words',
          fatal: false,
        });
      }

      if (!a.hasNumber) {
        issues.push({
          rule: 'answer_no_number',
          message: `${label} contains no specific number`,
          suggestion: 'Add a price in INR, percentage, star rating, distance, year, or count',
          fatal: true,
        });
      }
    }
  }

  private checkBlockedPhrases(html: string, issues: ValidationIssue[]): void {
    const plainText = this.stripTags(html).toLowerCase();
    for (const { phrase, suggestion } of BLOCKED_PHRASES) {
      if (plainText.includes(phrase)) {
        issues.push({
          rule: 'blocked_phrase',
          message: `Blocked phrase detected: "${phrase}"`,
          suggestion,
          fatal: false,
        });
      }
    }
  }

  private stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
