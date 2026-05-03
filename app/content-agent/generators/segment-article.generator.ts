import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { GeneratedContent } from '../content-agent.types';

export interface SegmentArticleInput {
  clientName: string;
  brandName: string;
  city: string;
  state: string;
  websiteUrl: string;
  verticalName: string;
  segment: string;
  targetQuestion?: string;
  gapSummary?: string;
}

const SYSTEM_PROMPT = `You are an AEO content writer specialising in Answer Engine Optimization (AEO).
You write Segment Articles that get cited by AI engines when buyers in a specific segment research their purchase decision.

RULES — enforced without exception:
1. Target word count: 1200-1800 words for the body text (excluding JSON-LD blocks). Count carefully.
2. Use H2 subheadings every 250-350 words. Every H2 must contain a specific searchable term — never generic headers like "Introduction" or "Conclusion".
3. Choose schema type: use HowTo schema if the article describes a step-by-step process; use Article schema if it explains a concept, comparison, or buyers guide.
4. Mention the client brand naturally in 2-3 places across the full article — not in every section, not as a promotional plug. It must feel like an organic reference.
5. Include at least one specific number (price, percentage, count, distance, time, rating) per 200 words of body text.
6. The final section must be a Q&A block with 3-4 questions relevant to the segment, followed by answers of 40-70 words each. Use FAQPage JSON-LD for this section.
7. Total JSON-LD blocks: exactly 2 — one HowTo or Article schema, one FAQPage schema.
8. No placeholder text, no [bracket variables], no Lorem ipsum.
9. No section that begins with "In conclusion" or "To summarise".
10. Page title under 70 characters — must target the segment's primary search intent.

OUTPUT FORMAT: complete HTML5 only. No markdown. No code fences.`;

@Injectable()
export class SegmentArticleGeneratorService {
  private readonly logger = new Logger(SegmentArticleGeneratorService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env['OPENROUTER_API_KEY'],
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async generate(input: SegmentArticleInput): Promise<GeneratedContent> {
    const userMessage = this.buildUserMessage(input);

    let html: string;
    try {
      const response = await this.openai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 6000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      });
      html = response.choices[0]?.message.content?.trim() ?? '';
    } catch (err) {
      throw new Error(`Segment article generation failed: ${(err as Error).message}`);
    }

    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      throw new Error(`Segment article generator returned non-HTML content (${html.length} chars)`);
    }

    const title = this.extractTitle(html);
    const schemaJson = this.extractFirstSchema(html);

    this.logger.log(
      `Segment article generated for ${input.brandName} (segment: ${input.segment}) — ${html.length} chars`,
    );

    return { title, htmlContent: html, schemaJson, generationPrompt: userMessage };
  }

  private buildUserMessage(input: SegmentArticleInput): string {
    const lines = [
      `Generate a Segment Article for the following client and buyer segment.`,
      ``,
      `CLIENT NAME: ${input.clientName}`,
      `BRAND: ${input.brandName}`,
      `LOCATION: ${input.city}, ${input.state}, India`,
      `WEBSITE: ${input.websiteUrl}`,
      `VERTICAL: ${input.verticalName}`,
      `TARGET SEGMENT: ${input.segment}`,
    ];

    if (input.targetQuestion) {
      lines.push(
        ``,
        `PRIMARY QUESTION TO ADDRESS: ${input.targetQuestion}`,
        `The article must fully answer this question and treat it as the central theme.`,
      );
    }

    if (input.gapSummary) {
      lines.push(
        ``,
        `GAP CONTEXT — use to identify which topics the article should cover:`,
        input.gapSummary,
      );
    }

    lines.push(
      ``,
      `Return the complete HTML5 Segment Article now. Follow every RULE in the system prompt exactly.`,
      `Remember: 1200-1800 words of body text, 2 JSON-LD blocks, client brand mentioned naturally in 2-3 places only.`,
    );

    return lines.join('\n');
  }

  private extractTitle(html: string): string {
    const m =
      html.match(/<title[^>]*>([^<]+)<\/title>/i) ??
      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    return m ? m[1].trim().slice(0, 70) : 'Article';
  }

  private extractFirstSchema(html: string): object {
    const m = html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!m) return {};
    try {
      return JSON.parse(m[1]) as object;
    } catch {
      return {};
    }
  }
}
