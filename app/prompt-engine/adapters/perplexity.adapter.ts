import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../prompt-engine.constants';
import { EngineResult, IEngineAdapter } from './engine-adapter.interface';

const INPUT_COST_PER_TOKEN = 1 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 1 / 1_000_000;

@Injectable()
export class PerplexityAdapter implements IEngineAdapter {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env['OPENROUTER_API_KEY'],
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async execute(promptText: string): Promise<EngineResult> {
    const response = await this.client.chat.completions.create({
      model: 'perplexity/sonar',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: promptText },
      ],
    });

    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    return {
      text: response.choices[0]?.message.content ?? '',
      inputTokens,
      outputTokens,
      costUsd: inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN,
    };
  }
}
