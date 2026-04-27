import { Module } from '@nestjs/common';
import { TenantScopedPrismaService } from './prisma/tenant-scoped-prisma.service';

@Module({
  providers: [TenantScopedPrismaService],
  exports: [TenantScopedPrismaService],
})
export class CommonModule {}
