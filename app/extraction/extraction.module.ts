import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExtractionController } from './extraction.controller';
import { ExtractionHaikuService } from './extraction-haiku.service';
import { ExtractionResolverService } from './extraction-resolver.service';
import { ExtractionService } from './extraction.service';
import { ExtractionWriterService } from './extraction-writer.service';

@Module({
  imports: [PrismaModule],
  controllers: [ExtractionController],
  providers: [
    ExtractionService,
    ExtractionHaikuService,
    ExtractionResolverService,
    ExtractionWriterService,
  ],
  exports: [ExtractionService],
})
export class ExtractionModule {}
