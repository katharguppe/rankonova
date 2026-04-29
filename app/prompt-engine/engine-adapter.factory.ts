import { Injectable } from '@nestjs/common';
import { AiEngine } from '@prisma/client';
import { ChatGptAdapter } from './adapters/chatgpt.adapter';
import { ClaudeAdapter } from './adapters/claude.adapter';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { GoogleAioAdapter } from './adapters/google-aio.adapter';
import { GrokAdapter } from './adapters/grok.adapter';
import { PerplexityAdapter } from './adapters/perplexity.adapter';
import { IEngineAdapter } from './adapters/engine-adapter.interface';

@Injectable()
export class EngineAdapterFactory {
  constructor(
    private readonly chatGpt: ChatGptAdapter,
    private readonly perplexity: PerplexityAdapter,
    private readonly gemini: GeminiAdapter,
    private readonly claude: ClaudeAdapter,
    private readonly grok: GrokAdapter,
    private readonly googleAio: GoogleAioAdapter,
  ) {}

  get(engine: AiEngine): IEngineAdapter {
    switch (engine) {
      case AiEngine.chatgpt:
        return this.chatGpt;
      case AiEngine.perplexity:
        return this.perplexity;
      case AiEngine.gemini:
        return this.gemini;
      case AiEngine.claude:
        return this.claude;
      case AiEngine.grok:
        return this.grok;
      case AiEngine.google_ai_overviews:
        return this.googleAio;
    }
  }
}
