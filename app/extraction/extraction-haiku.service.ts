import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
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

const USER_TEMPLATE = (raw: string) =>
  `Extract all brand mentions from this AI response.\n` +
  `Return exactly: {"mentions":[{"brand":string,"position":number,"sentiment":"positive"|"negative"|"neutral"|"mixed","cited_url":string|null,"context_snippet":string|null}]}\n\n` +
  `Response:\n${raw}`;

@Injectable()
export class ExtractionHaikuService {
  private readonly logger = new Logger(ExtractionHaikuService.name);
  private readonly client: OpenAI;

  constructor() {
    // Cerebras llama3.1-8b: fast, free tier, OpenAI-compatible — used in place of Haiku
    this.client = new OpenAI({
      apiKey: process.env['CEREBRAS_API_KEY'],
      baseURL: 'https://api.cerebras.ai/v1',
    });
  }

  async extract(rawResponse: string): Promise<RawMention[]> {
    let text: string;
    try {
      const response = await this.client.chat.completions.create({
        model: 'llama3.1-8b',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: USER_TEMPLATE(rawResponse) },
        ],
      });
      text = response.choices[0]?.message.content ?? '';
    } catch (err) {
      this.logger.error(`Extraction LLM error: ${(err as Error).message}`);
      return [];
    }

    // Strip markdown code fences if model wraps the JSON
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    try {
      const parsed = JSON.parse(cleaned) as { mentions?: unknown[] };
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
      this.logger.warn(`Extraction returned unparseable JSON — skipping. Raw: ${text.slice(0, 200)}`);
      return [];
    }
  }

  private parseSentiment(value: unknown): Sentiment {
    const valid: Sentiment[] = ['positive', 'negative', 'neutral', 'mixed'];
    return valid.includes(value as Sentiment) ? (value as Sentiment) : 'neutral';
  }
}
