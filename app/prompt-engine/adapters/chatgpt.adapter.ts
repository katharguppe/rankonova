import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../prompt-engine.constants';
import { EngineResult, IEngineAdapter } from './engine-adapter.interface';

const INPUT_COST_PER_TOKEN = 5 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

@Injectable()
export class ChatGptAdapter implements IEngineAdapter {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
  }

  async execute(promptText: string): Promise<EngineResult> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1500,
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
