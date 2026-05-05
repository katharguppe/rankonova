import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KnowledgeGraphController } from './knowledge-graph.controller';
import { KnowledgeGraphService } from './knowledge-graph.service';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeGraphController],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
