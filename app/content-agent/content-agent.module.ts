import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContentAgentController } from './content-agent.controller';
import { ContentAgentService } from './content-agent.service';
import { FaqPageGeneratorService } from './generators/faq-page.generator';
import { ComparisonPageGeneratorService } from './generators/comparison-page.generator';
import { EntityAuthorityPageGeneratorService } from './generators/entity-authority-page.generator';
import { SegmentArticleGeneratorService } from './generators/segment-article.generator';
import { QualityValidatorService } from './validators/quality-validator';

@Module({
  imports: [PrismaModule],
  controllers: [ContentAgentController],
  providers: [
    ContentAgentService,
    FaqPageGeneratorService,
    ComparisonPageGeneratorService,
    EntityAuthorityPageGeneratorService,
    SegmentArticleGeneratorService,
    QualityValidatorService,
  ],
  exports: [ContentAgentService],
})
export class ContentAgentModule {}
