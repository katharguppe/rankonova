import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';

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

  async updateClientProfile(
    clientId: string,
    tenantId: string,
    profileData: UpdateClientProfileDto,
  ) {
    // Verify client exists and belongs to tenant
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenant_id: tenantId, deleted_at: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Update only profile fields
    return this.prisma.client.update({
      where: { id: clientId },
      data: {
        digital_handles: profileData.digital_handles
          ? (profileData.digital_handles as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        brand_description: profileData.brand_description || null,
        brand_keywords: profileData.brand_keywords
          ? (profileData.brand_keywords as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        competitors_known: profileData.competitors_known
          ? (profileData.competitors_known as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        updated_at: new Date(),
      },
      select: {
        id: true,
        tenant_id: true,
        vertical_id: true,
        name: true,
        brand_name: true,
        city: true,
        state: true,
        website_url: true,
        description: true,
        aliases: true,
        models: true,
        is_active: true,
        digital_handles: true,
        brand_description: true,
        brand_keywords: true,
        competitors_known: true,
        created_at: true,
        updated_at: true,
      },
    });
  }
}
