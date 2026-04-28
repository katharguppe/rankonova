import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaModule } from '../prisma/prisma.module';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { QuotaService, REDIS_CLIENT } from './quota.service';
import { QuotaGuard } from './quota.guard';

@Module({
  imports: [PrismaModule],
  controllers: [PromptsController],
  providers: [
    PromptsService,
    QuotaService,
    QuotaGuard,
    {
      provide: REDIS_CLIENT,
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
    },
  ],
  exports: [PromptsService, QuotaService, QuotaGuard],
})
export class PromptsModule {}
