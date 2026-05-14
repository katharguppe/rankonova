import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PromptsModule } from '../prompts/prompts.module';
import { VerticalsController } from './verticals.controller';
import { VerticalsService } from './verticals.service';

@Module({
  imports: [PrismaModule, PromptsModule],
  controllers: [VerticalsController],
  providers: [VerticalsService],
  exports: [VerticalsService],
})
export class VerticalsModule {}
