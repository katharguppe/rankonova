import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '../prompt-engine.constants';
import { EngineResult, IEngineAdapter } from './engine-adapter.interface';

const INPUT_COST_PER_TOKEN = 0.075 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 0.30 / 1_000_000;

@Injectable()
export class GeminiAdapter implements IEngineAdapter {
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env['GOOGLE_API_KEY'] ?? '');
  }

  async execute(promptText: string): Promise<EngineResult> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(promptText);
    const response = result.response;
    const usage = response.usageMetadata;

    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;

    return {
      text: response.text(),
      inputTokens,
      outputTokens,
      costUsd: inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN,
    };
  }
}
