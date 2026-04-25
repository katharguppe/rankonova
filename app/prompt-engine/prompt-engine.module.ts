import { Module } from '@nestjs/common';
import { PromptEngineController } from './prompt-engine.controller';
import { PromptEngineService } from './prompt-engine.service';

@Module({
  controllers: [PromptEngineController],
  providers: [PromptEngineService],
  exports: [PromptEngineService],
})
export class PromptEngineModule {}
