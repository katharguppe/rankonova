import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AggregatorController } from './aggregator.controller';
import { AggregatorService } from './aggregator.service';

@Module({
  imports: [PrismaModule],
  controllers: [AggregatorController],
  providers: [AggregatorService],
  exports: [AggregatorService],
})
export class AggregatorModule {}
