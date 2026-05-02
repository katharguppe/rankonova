import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForTenant(tenantId: string) {
    return this.prisma.client.findMany({
      where: { tenant_id: tenantId, is_active: true, deleted_at: null },
      select: { id: true, brand_name: true, city: true, state: true },
      orderBy: { brand_name: 'asc' },
    });
  }

  findOne(clientId: string, tenantId: string) {
    return this.prisma.client.findFirst({
      where: { id: clientId, tenant_id: tenantId, is_active: true, deleted_at: null },
      select: { id: true, brand_name: true, city: true, state: true },
    });
  }
}
