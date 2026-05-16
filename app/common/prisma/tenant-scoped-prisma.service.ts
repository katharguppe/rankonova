import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export class TenantContext {
  constructor(
    private readonly db: PrismaService,
    readonly tenantId: string,
  ) {}

  // ── Tenant ──────────────────────────────────────────────────────────────────

  findTenant() {
    return this.db.tenant.findUnique({ where: { id: this.tenantId } });
  }

  updateTenant(data: { name?: string; billing_email?: string }) {
    return this.db.tenant.update({ where: { id: this.tenantId }, data });
  }

  // ── Clients ─────────────────────────────────────────────────────────────────

  countActiveClients() {
    return this.db.client.count({
      where: { tenant_id: this.tenantId, is_active: true, deleted_at: null },
    });
  }

  findClients() {
    return this.db.client.findMany({
      where: { tenant_id: this.tenantId, is_active: true, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
  }

  findClient(clientId: string) {
    return this.db.client.findFirst({
      where: { id: clientId, tenant_id: this.tenantId, is_active: true, deleted_at: null },
    });
  }

  createClient(data: {
    vertical_id: string;
    name: string;
    brand_name: string;
    aliases: Prisma.InputJsonValue;
    city: string;
    state: string;
    website_url: string;
    description?: string;
    models: Prisma.InputJsonValue;
    digital_handles?: Prisma.InputJsonValue;
    brand_description?: string;
    brand_keywords?: Prisma.InputJsonValue;
    competitors_known?: Prisma.InputJsonValue;
  }) {
    return this.db.client.create({ data: { ...data, tenant_id: this.tenantId } });
  }

  async updateClient(clientId: string, data: Record<string, unknown>) {
    const { count } = await this.db.client.updateMany({
      where: { id: clientId, tenant_id: this.tenantId, is_active: true, deleted_at: null },
      data,
    });
    if (count === 0) return null;
    return this.db.client.findUnique({ where: { id: clientId } });
  }

  async softDeleteClient(clientId: string): Promise<boolean> {
    const { count } = await this.db.client.updateMany({
      where: { id: clientId, tenant_id: this.tenantId, is_active: true },
      data: { is_active: false, deleted_at: new Date() },
    });
    return count > 0;
  }
}

@Injectable()
export class TenantScopedPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  forTenant(tenantId: string): TenantContext {
    return new TenantContext(this.prisma, tenantId);
  }
}
