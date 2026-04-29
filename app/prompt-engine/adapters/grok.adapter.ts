import { Injectable, NotImplementedException } from '@nestjs/common';
import { EngineResult, IEngineAdapter } from './engine-adapter.interface';

@Injectable()
export class GrokAdapter implements IEngineAdapter {
  execute(_promptText: string): Promise<EngineResult> {
    throw new NotImplementedException('Grok engine: API key not available');
  }
}
