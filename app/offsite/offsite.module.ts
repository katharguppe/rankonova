import { Module } from '@nestjs/common';
import { AggregatorModule } from './aggregator/aggregator.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CommunityModule } from './community/community.module';
import { KnowledgeGraphModule } from './knowledge-graph/knowledge-graph.module';
import { PrModule } from './pr/pr.module';

@Module({
  imports: [
    AggregatorModule,
    ReviewsModule,
    CommunityModule,
    KnowledgeGraphModule,
    PrModule,
  ],
  exports: [
    AggregatorModule,
    ReviewsModule,
    CommunityModule,
    KnowledgeGraphModule,
    PrModule,
  ],
})
export class OffsiteModule {}
