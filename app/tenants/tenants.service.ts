import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PlanTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedPrismaService } from '../common/prisma/tenant-scoped-prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const PLAN_CLIENT_LIMITS: Record<PlanTier, number> = {
  starter: 1,
  growth: 10,
  enterprise: Number.MAX_SAFE_INTEGER,
};

const PLAN_QUOTA: Record<PlanTier, number> = {
  starter: 500,
  growth: 5000,
  enterprise: -1,
};

@Injectable()
export class TenantsService {
  constructor(
    private readonly scoped: TenantScopedPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Tenant operations ──────────────────────────────────────────────────────

  async getMyTenant(tenantId: string) {
    const tenant = await this.scoped.forTenant(tenantId).findTenant();
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateMyTenant(tenantId: string, dto: UpdateTenantDto) {
    const data: { name?: string; billing_email?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.billingEmail !== undefined) data.billing_email = dto.billingEmail;
    return this.scoped.forTenant(tenantId).updateTenant(data);
  }

  getAllTenants() {
    return this.prisma.tenant.findMany({ orderBy: { created_at: 'desc' } });
  }

  async getTenantById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  changePlan(tenantId: string, planTier: PlanTier) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan_tier: planTier, prompt_quota_daily: PLAN_QUOTA[planTier] },
    });
  }

  // ── Client operations ──────────────────────────────────────────────────────

  async createClient(tenantId: string, dto: CreateClientDto) {
    const ctx = this.scoped.forTenant(tenantId);
    const tenant = await ctx.findTenant();
    if (!tenant) throw new NotFoundException('Tenant not found');

    const limit = PLAN_CLIENT_LIMITS[tenant.plan_tier];
    const count = await ctx.countActiveClients();
    if (count >= limit) {
      throw new ForbiddenException(
        `Client limit reached: ${limit} client(s) allowed on ${tenant.plan_tier} plan`,
      );
    }

    return ctx.createClient({
      vertical_id: dto.verticalId,
      name: dto.name,
      brand_name: dto.brandName,
      aliases: dto.aliases as Prisma.InputJsonValue,
      city: dto.city,
      state: dto.state,
      website_url: dto.websiteUrl,
      description: dto.description,
      models: (dto.models ?? {}) as Prisma.InputJsonValue,
      digital_handles: dto.digital_handles
        ? (dto.digital_handles as unknown as Prisma.InputJsonValue)
        : undefined,
      brand_description: dto.brand_description,
      brand_keywords: dto.brand_keywords
        ? (dto.brand_keywords as unknown as Prisma.InputJsonValue)
        : undefined,
      competitors_known: dto.competitors_known
        ? (dto.competitors_known as unknown as Prisma.InputJsonValue)
        : undefined,
    });
  }

  getClients(tenantId: string) {
    return this.scoped.forTenant(tenantId).findClients();
  }

  async getClient(tenantId: string, clientId: string) {
    const client = await this.scoped.forTenant(tenantId).findClient(clientId);
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async updateClient(tenantId: string, clientId: string, dto: UpdateClientDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.brandName !== undefined) data['brand_name'] = dto.brandName;
    if (dto.aliases !== undefined) data['aliases'] = dto.aliases;
    if (dto.city !== undefined) data['city'] = dto.city;
    if (dto.state !== undefined) data['state'] = dto.state;
    if (dto.websiteUrl !== undefined) data['website_url'] = dto.websiteUrl;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.models !== undefined) data['models'] = dto.models;

    const updated = await this.scoped.forTenant(tenantId).updateClient(clientId, data);
    if (!updated) throw new NotFoundException('Client not found');
    return updated;
  }

  async softDeleteClient(tenantId: string, clientId: string): Promise<void> {
    const deleted = await this.scoped.forTenant(tenantId).softDeleteClient(clientId);
    if (!deleted) throw new NotFoundException('Client not found');
  }
}
