import { Injectable, NotImplementedException } from '@nestjs/common';
import { EngineResult, IEngineAdapter } from './engine-adapter.interface';

// TODO [session: fix-perplexity]: Replace this stub with a direct Perplexity API
// integration (sonar model via https://api.perplexity.ai). OpenRouter is not used
// in production — this adapter intentionally throws until that session runs.

@Injectable()
export class PerplexityAdapter implements IEngineAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(_promptText: string): Promise<EngineResult> {
    throw new NotImplementedException(
      'PerplexityAdapter is not yet implemented. ' +
        'Will be replaced with direct Perplexity API in session fix-perplexity.',
    );
  }
}
