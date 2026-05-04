import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { GeneratedContent } from '../content-agent.types';

export interface FaqGeneratorInput {
  clientName: string;
  brandName: string;
  city: string;
  state: string;
  websiteUrl: string;
  verticalName: string;
  gapSummary?: string;
  targetQuestion?: string;
  revisionNotes?: string;
}

const SYSTEM_PROMPT = `You are an AEO content writer specialising in Answer Engine Optimization (AEO).
You produce HTML FAQ pages with embedded JSON-LD that get cited by AI engines (ChatGPT, Perplexity, Gemini, Google AI Overviews).

RULES — enforced without exception:
1. Every answer must open with the direct answer in the FIRST SENTENCE. No preamble. Never start with "Great question", "Sure", "Absolutely", or any filler phrase.
2. Every answer must contain at least one SPECIFIC NUMBER: a price in INR, a percentage, a count, a distance in km, a star rating, years of operation, square feet, or similar measurable fact.
3. Every answer must be between 50 and 90 words. Count carefully before outputting.
4. Never use superlatives (best, fastest, cheapest, most trusted, highest-rated) unless the very next clause contains a specific data citation, e.g. "rated 4.8/5 by 2,300 Google reviewers".
5. Where the client has a measurable advantage over a named competitor, state it explicitly with data.
6. Generate exactly 6 to 8 question-answer pairs. Cover: purchase intent, comparison with competitors, specific features, pricing, location/service area, and trust signals.

OUTPUT FORMAT — return complete HTML5 only. No markdown. No code fences. No explanatory text outside the HTML.

The page must follow this structure exactly:
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[PAGE TITLE — MUST BE UNDER 70 CHARACTERS]</title>
  <script type="application/ld+json">
  { "FAQPage JSON-LD here" }
  </script>
  <script type="application/ld+json">
  { "Secondary vertical schema here: LocalBusiness, AutoDealer, RealEstateAgent, MedicalBusiness, etc." }
  </script>
</head>
<body>
  <h1>[Same as title]</h1>
  <div class="faq">
    <div class="faq-item">
      <h2>[Question]</h2>
      <p>[Answer — 50-90 words, starts with direct answer, contains a number]</p>
    </div>
    <!-- repeat for each Q&A pair -->
  </div>
</body>
</html>`;

@Injectable()
export class FaqPageGeneratorService {
  private readonly logger = new Logger(FaqPageGeneratorService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env['CEREBRAS_API_KEY'],
      baseURL: 'https://api.cerebras.ai/v1',
    });
  }

  async generate(input: FaqGeneratorInput): Promise<GeneratedContent> {
    const userMessage = this.buildUserMessage(input);

    let html: string;
    try {
      const response = await this.openai.chat.completions.create({
        model: 'llama3.1-8b',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      });
      html = response.choices[0]?.message.content?.trim() ?? '';
    } catch (err) {
      throw new Error(`FAQ generation API call failed: ${(err as Error).message}`);
    }

    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      this.logger.warn(`llama3.1-8b returned markdown — wrapping in HTML shell (${html.length} chars)`);
      html = `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>${input.brandName} | AEO FAQ</title></head>\n<body>\n${html}\n</body>\n</html>`;
    }

    const title = this.extractTitle(html);
    const schemaJson = this.extractFirstSchema(html);

    this.logger.log(
      `FAQ page generated for ${input.brandName} — ${html.length} chars, title: "${title}"`,
    );

    return { title, htmlContent: html, schemaJson, generationPrompt: userMessage };
  }

  private buildUserMessage(input: FaqGeneratorInput): string {
    const lines = [
      `Generate a complete FAQ page for this client.`,
      ``,
      `CLIENT NAME: ${input.clientName}`,
      `BRAND: ${input.brandName}`,
      `LOCATION: ${input.city}, ${input.state}, India`,
      `WEBSITE: ${input.websiteUrl}`,
      `VERTICAL: ${input.verticalName}`,
    ];

    if (input.targetQuestion) {
      lines.push(
        ``,
        `PRIMARY QUESTION: ${input.targetQuestion}`,
        `The first Q&A pair must address this question directly.`,
      );
    }

    if (input.gapSummary) {
      lines.push(
        ``,
        `GAP CONTEXT — use to select which questions to answer:`,
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

    lines.push(``, `Return the complete HTML5 page now. Follow every RULE in the system prompt exactly.`);

    return lines.join('\n');
  }

  private extractTitle(html: string): string {
    const m =
      html.match(/<title[^>]*>([^<]+)<\/title>/i) ??
      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    return m ? m[1].trim().slice(0, 70) : 'FAQ';
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
