import { Module } from '@nestjs/common';
import { ContentAgentController } from './content-agent.controller';
import { ContentAgentService } from './content-agent.service';

@Module({
  controllers: [ContentAgentController],
  providers: [ContentAgentService],
  exports: [ContentAgentService],
})
export class ContentAgentModule {}
