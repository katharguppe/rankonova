import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VerticalsController } from './verticals.controller';
import { VerticalsService } from './verticals.service';

@Module({
  imports: [PrismaModule],
  controllers: [VerticalsController],
  providers: [VerticalsService],
  exports: [VerticalsService],
})
export class VerticalsModule {}
