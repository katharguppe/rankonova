import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Sentiment } from '@prisma/client';

export interface RawMention {
  brand: string;
  position: number;
  sentiment: Sentiment;
  cited_url: string | null;
  context_snippet: string | null;
}

const SYSTEM_PROMPT =
  'You are a brand mention extractor. Extract all brand mentions. ' +
  'Return valid JSON only. No explanation. No markdown.';

const SCHEMA_HINT =
  'Return exactly: { "mentions": [{ "brand": string, "position": number, ' +
  '"sentiment": "positive"|"negative"|"neutral"|"mixed", ' +
  '"cited_url": string|null, "context_snippet": string|null }] }';

@Injectable()
export class ExtractionHaikuService {
  private readonly logger = new Logger(ExtractionHaikuService.name);
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
  }

  async extract(rawResponse: string): Promise<RawMention[]> {
    let text: string;
    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Extract all brand mentions from this AI response.\n${SCHEMA_HINT}\n\nResponse:\n${rawResponse}`,
          },
        ],
      });
      text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    } catch (err) {
      this.logger.error(`Haiku API error: ${(err as Error).message}`);
      return [];
    }

    try {
      const parsed = JSON.parse(text) as { mentions?: unknown[] };
      const mentions = Array.isArray(parsed?.mentions) ? parsed.mentions : [];
      return mentions
        .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
        .map((m, idx) => ({
          brand: String(m['brand'] ?? '').trim(),
          position: typeof m['position'] === 'number' ? m['position'] : idx + 1,
          sentiment: this.parseSentiment(m['sentiment']),
          cited_url: typeof m['cited_url'] === 'string' ? m['cited_url'] : null,
          context_snippet: typeof m['context_snippet'] === 'string'
            ? String(m['context_snippet']).slice(0, 150)
            : null,
        }))
        .filter(m => m.brand.length > 0);
    } catch {
      this.logger.warn('Haiku returned unparseable JSON — skipping extraction');
      return [];
    }
  }

  private parseSentiment(value: unknown): Sentiment {
    const valid: Sentiment[] = ['positive', 'negative', 'neutral', 'mixed'];
    return valid.includes(value as Sentiment) ? (value as Sentiment) : 'neutral';
  }
}
