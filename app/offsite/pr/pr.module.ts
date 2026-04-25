import { Module } from '@nestjs/common';
import { PrService } from './pr.service';

@Module({
  providers: [PrService],
  exports: [PrService],
})
export class PrModule {}
