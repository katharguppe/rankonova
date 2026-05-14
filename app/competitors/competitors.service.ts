import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getBaselineCompetitorsForVertical } from './seed/competitors.seed';

@Injectable()
export class CompetitorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new competitor for a vertical
   * @throws ForbiddenException if cross-tenant access
   * @throws NotFoundException if vertical not found
   * @throws ConflictException if duplicate or max competitors reached
   * @throws BadRequestException if invalid aliases or empty name
   */
  async create(
    tenantId: string,
    verticalId: string,
    name: string,
    aliases?: string[],
    websiteUrl?: string,
  ) {
    // Validate name is not empty or whitespace-only
    if (!name?.trim()) {
      throw new BadRequestException('Competitor name cannot be empty');
    }

    // Verify vertical exists and belongs to system
    const vertical = await this.prisma.vertical.findFirst({
      where: { id: verticalId, is_active: true },
    });
    if (!vertical) throw new NotFoundException('Vertical not found');

    // Validate and filter aliases
    const cleanedAliases = this.validateAndFilterAliases(aliases);

    // Check for duplicate by name (case-insensitive within tenant+vertical)
    const existing = await this.prisma.competitor.findFirst({
      where: {
        tenant_id: tenantId,
        vertical_id: verticalId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Competitor '${name}' already exists for this vertical`,
      );
    }

    // Check count limit (max 10 per vertical)
    const count = await this.countByVertical(tenantId, verticalId);
    if (count >= 10) {
      throw new ConflictException(
        `Maximum 10 competitors per vertical reached`,
      );
    }

    return this.prisma.competitor.create({
      data: {
        tenant_id: tenantId,
        vertical_id: verticalId,
        name,
        aliases: cleanedAliases as Prisma.InputJsonValue,
        website_url: websiteUrl,
        is_active: true,
      },
    });
  }

  /**
   * List competitors with optional filtering
   */
  async list(
    tenantId: string,
    verticalId?: string,
    isActive: boolean = true,
  ) {
    const where: Prisma.CompetitorWhereInput = {
      tenant_id: tenantId,
      is_active: isActive,
    };

    if (verticalId) {
      where.vertical_id = verticalId;
    }

    return this.prisma.competitor.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update a competitor (ownership verified)
   * @throws ForbiddenException if cross-tenant access
   * @throws NotFoundException if competitor not found
   * @throws BadRequestException if invalid aliases
   */
  async update(
    id: string,
    tenantId: string,
    patch: {
      name?: string;
      aliases?: string[];
      websiteUrl?: string;
      isActive?: boolean;
    },
  ) {
    // Verify ownership
    await this.findCompetitorByIdAndTenant(id, tenantId);

    // Validate aliases if provided
    let cleanedAliases: string[] | undefined;
    if (patch.aliases !== undefined) {
      cleanedAliases = this.validateAndFilterAliases(patch.aliases);
    }

    const data: Prisma.CompetitorUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.aliases !== undefined) data.aliases = cleanedAliases as Prisma.InputJsonValue;
    if (patch.websiteUrl !== undefined) data.website_url = patch.websiteUrl;
    if (patch.isActive !== undefined) data.is_active = patch.isActive;

    return this.prisma.competitor.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-delete a competitor (ownership verified)
   * @throws ForbiddenException if cross-tenant access
   * @throws NotFoundException if competitor not found
   */
  async delete(id: string, tenantId: string) {
    // Verify ownership
    await this.findCompetitorByIdAndTenant(id, tenantId);

    return this.prisma.competitor.update({
      where: { id },
      data: { is_active: false },
    });
  }

  /**
   * Count active competitors for a vertical
   */
  async countByVertical(tenantId: string, verticalId: string): Promise<number> {
    return this.prisma.competitor.count({
      where: {
        tenant_id: tenantId,
        vertical_id: verticalId,
        is_active: true,
      },
    });
  }

  /**
   * Seed baseline competitors for a vertical
   * Idempotent: checks if count >= 10, skips if already seeded
   * Partial failure resilient: logs errors and continues
   * @returns array of created competitors
   */
  async seed(
    tenantId: string,
    verticalId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      aliases: string[];
      website_url: string | null;
    }>
  > {
    // Verify vertical exists
    const vertical = await this.prisma.vertical.findFirst({
      where: { id: verticalId, is_active: true },
    });
    if (!vertical) throw new NotFoundException('Vertical not found');

    // Idempotency check: if already has 10+, skip
    const count = await this.countByVertical(tenantId, verticalId);
    if (count >= 10) {
      console.log(
        `[CompetitorsService.seed] Vertical ${verticalId} already has ${count} competitors, skipping`,
      );
      return [];
    }

    // Get baseline competitors for this vertical
    const baseline = getBaselineCompetitorsForVertical(vertical.slug);
    if (baseline.length === 0) {
      console.warn(
        `[CompetitorsService.seed] No baseline competitors found for vertical '${vertical.slug}'`,
      );
      return [];
    }

    // Create competitors, continue on partial failure
    const created: Array<{
      id: string;
      name: string;
      aliases: string[];
      website_url: string | null;
    }> = [];

    for (const competitor of baseline) {
      try {
        const created_item = await this.create(
          tenantId,
          verticalId,
          competitor.name,
          competitor.aliases,
          competitor.websiteUrl,
        );
        created.push({
          id: created_item.id,
          name: created_item.name,
          aliases: created_item.aliases as string[],
          website_url: created_item.website_url,
        });
      } catch (error) {
        // Log error and continue (resilient to duplicates or other transient failures)
        console.error(
          `[CompetitorsService.seed] Failed to create competitor '${competitor.name}':`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    console.log(
      `[CompetitorsService.seed] Seeded ${created.length}/${baseline.length} competitors for vertical ${verticalId}`,
    );
    return created;
  }

  /**
   * Helper: find competitor by id and verify tenant ownership
   * @throws ForbiddenException if competitor not found or tenant mismatch
   */
  private async findCompetitorByIdAndTenant(
    id: string,
    tenantId: string,
  ): Promise<void> {
    const competitor = await this.prisma.competitor.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!competitor) {
      throw new ForbiddenException('Competitor not found or access denied');
    }
  }

  /**
   * Helper: validate and filter aliases
   * - Must be non-empty strings
   * - Filter out empty/whitespace-only aliases
   * @throws BadRequestException if invalid format
   */
  private validateAndFilterAliases(aliases?: string[]): string[] {
    if (!aliases) return [];

    if (!Array.isArray(aliases)) {
      throw new BadRequestException('Aliases must be an array');
    }

    const filtered = aliases
      .filter((alias) => typeof alias === 'string' && alias.trim().length > 0)
      .map((alias) => alias.trim());

    return filtered;
  }
}
