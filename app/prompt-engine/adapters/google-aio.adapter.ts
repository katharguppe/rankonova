import { Injectable, NotImplementedException } from '@nestjs/common';
import { EngineResult, IEngineAdapter } from './engine-adapter.interface';

@Injectable()
export class GoogleAioAdapter implements IEngineAdapter {
  execute(_promptText: string): Promise<EngineResult> {
    throw new NotImplementedException('Google AI Overviews engine: deferred pending ToS review');
  }
}
