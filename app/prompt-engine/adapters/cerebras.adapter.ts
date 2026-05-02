import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../prompt-engine.constants';
import { EngineResult, IEngineAdapter } from './engine-adapter.interface';

const INPUT_COST_PER_TOKEN = 0.6 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 0.6 / 1_000_000;

@Injectable()
export class CerebrasAdapter implements IEngineAdapter {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env['CEREBRAS_API_KEY'],
      baseURL: 'https://api.cerebras.ai/v1',
    });
  }

  async execute(promptText: string): Promise<EngineResult> {
    const response = await this.client.chat.completions.create({
      model: 'llama3.1-8b',
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
