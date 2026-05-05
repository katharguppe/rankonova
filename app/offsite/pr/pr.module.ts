import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrController } from './pr.controller';
import { PrService } from './pr.service';

@Module({
  imports: [PrismaModule],
  controllers: [PrController],
  providers: [PrService],
  exports: [PrService],
})
export class PrModule {}
