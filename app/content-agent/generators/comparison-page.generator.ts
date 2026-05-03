import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { GeneratedContent } from '../content-agent.types';

export interface ComparisonPageInput {
  clientName: string;
  brandName: string;
  city: string;
  state: string;
  websiteUrl: string;
  verticalName: string;
  competitorNames: string[];
  gapSummary?: string;
  revisionNotes?: string;
}

const SYSTEM_PROMPT = `You are an AEO content writer specialising in Answer Engine Optimization (AEO).
You produce Comparison Pages that get cited by AI engines when users compare service providers.

RULES — enforced without exception:
1. Include a spec/comparison table with at least 5 dimensions (price range, service area, years in operation, ratings, specialisations, certifications, response time, etc.).
2. The table MUST use semantic HTML: <table>, <thead>, <tbody>, <th scope="col">, <td>. Never use an image for the table.
3. Every table cell must contain a specific value. Use "Contact for quote" only for price if genuinely unknown — all other cells must have real data.
4. Highlight 2-3 measurable client advantages in the table (use a <strong> tag for the winning cell value).
5. Include a FAQPage section with exactly 4-6 Q&A pairs comparing the client against named competitors. Every answer: 50-90 words, first sentence = direct answer, at least one specific number.
6. Use FAQPage JSON-LD as the first <script type="application/ld+json"> block.
7. Use a LocalBusiness or vertical-appropriate schema for the client as the second <script type="application/ld+json"> block.
8. Append "as of [year]" after any pricing or rating claim.
9. No superlatives without an immediately following data citation.
10. Page title format: "[Client Brand] vs [Competitor]: [Vertical] Comparison [City]" — under 70 characters.

OUTPUT FORMAT: complete HTML5 only. No markdown. No code fences. No text outside the HTML tags.`;

@Injectable()
export class ComparisonPageGeneratorService {
  private readonly logger = new Logger(ComparisonPageGeneratorService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env['OPENROUTER_API_KEY'],
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async generate(input: ComparisonPageInput): Promise<GeneratedContent> {
    const userMessage = this.buildUserMessage(input);

    let html: string;
    try {
      const response = await this.openai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 4500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      });
      html = response.choices[0]?.message.content?.trim() ?? '';
    } catch (err) {
      throw new Error(`Comparison page generation failed: ${(err as Error).message}`);
    }

    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      throw new Error(`Comparison page generator returned non-HTML content (${html.length} chars)`);
    }

    const title = this.extractTitle(html);
    const schemaJson = this.extractFirstSchema(html);

    this.logger.log(
      `Comparison page generated for ${input.brandName} vs [${input.competitorNames.join(', ')}] — ${html.length} chars`,
    );

    return { title, htmlContent: html, schemaJson, generationPrompt: userMessage };
  }

  private buildUserMessage(input: ComparisonPageInput): string {
    const competitors =
      input.competitorNames.length > 0
        ? input.competitorNames.join(', ')
        : `typical ${input.verticalName} competitors in ${input.city}`;

    const lines = [
      `Generate a Comparison Page for this client vs their competitors.`,
      ``,
      `CLIENT NAME: ${input.clientName}`,
      `BRAND: ${input.brandName}`,
      `LOCATION: ${input.city}, ${input.state}, India`,
      `WEBSITE: ${input.websiteUrl}`,
      `VERTICAL: ${input.verticalName}`,
      `COMPARE AGAINST: ${competitors}`,
    ];

    if (input.gapSummary) {
      lines.push(
        ``,
        `GAP CONTEXT — use to identify which dimensions to compare:`,
        input.gapSummary,
      );
    }

    if (input.revisionNotes) {
      lines.push(
        ``,
        `REVISION INSTRUCTIONS — the previous version had these issues. Address ALL of them:`,
        input.revisionNotes,
      );
    }

    lines.push(
      ``,
      `Return the complete HTML5 Comparison Page now. Follow every RULE in the system prompt exactly.`,
    );

    return lines.join('\n');
  }

  private extractTitle(html: string): string {
    const m =
      html.match(/<title[^>]*>([^<]+)<\/title>/i) ??
      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    return m ? m[1].trim().slice(0, 70) : 'Comparison';
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
