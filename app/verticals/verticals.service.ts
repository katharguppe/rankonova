import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PromptsService } from '../prompts/prompts.service';
import { CompetitorsService } from '../competitors/competitors.service';
import { CreateVerticalDto } from './dto/create-vertical.dto';
import { UpdateVerticalDto } from './dto/update-vertical.dto';
import { CloneVerticalDto } from './dto/clone-vertical.dto';

@Injectable()
export class VerticalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptsService: PromptsService,
    private readonly competitorsService: CompetitorsService,
  ) {}

  findAll() {
    return this.prisma.vertical.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const vertical = await this.prisma.vertical.findFirst({
      where: { id, is_active: true },
    });
    if (!vertical) throw new NotFoundException('Vertical not found');
    return vertical;
  }

  async create(dto: CreateVerticalDto) {
    const existing = await this.prisma.vertical.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug '${dto.slug}' already taken`);

    const vertical = await this.prisma.vertical.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        prompt_templates: dto.promptTemplates as Prisma.InputJsonValue,
        intent_categories: dto.intentCategories as Prisma.InputJsonValue,
        trusted_domains: dto.trustedDomains as Prisma.InputJsonValue,
        aggregator_platforms: dto.aggregatorPlatforms as Prisma.InputJsonValue,
        schema_types: dto.schemaTypes as Prisma.InputJsonValue,
        community_platforms: dto.communityPlatforms as Prisma.InputJsonValue,
        wikidata_entity_type: dto.wikidataEntityType,
        review_platforms: dto.reviewPlatforms as Prisma.InputJsonValue,
      },
    });

    await this.promptsService.seedDefaultPrompts(
      vertical.id,
      (dto.intentCategories ?? []) as string[],
    );

    return vertical;
  }

  async update(id: string, dto: UpdateVerticalDto, userId: string) {
    const current = await this.findOne(id);

    const data: Prisma.VerticalUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) {
      const taken = await this.prisma.vertical.findUnique({ where: { slug: dto.slug } });
      if (taken && taken.id !== id) throw new ConflictException(`Slug '${dto.slug}' already taken`);
      data.slug = dto.slug;
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.promptTemplates !== undefined) data.prompt_templates = dto.promptTemplates as Prisma.InputJsonValue;
    if (dto.intentCategories !== undefined) data.intent_categories = dto.intentCategories as Prisma.InputJsonValue;
    if (dto.trustedDomains !== undefined) data.trusted_domains = dto.trustedDomains as Prisma.InputJsonValue;
    if (dto.aggregatorPlatforms !== undefined) data.aggregator_platforms = dto.aggregatorPlatforms as Prisma.InputJsonValue;
    if (dto.schemaTypes !== undefined) data.schema_types = dto.schemaTypes as Prisma.InputJsonValue;
    if (dto.communityPlatforms !== undefined) data.community_platforms = dto.communityPlatforms as Prisma.InputJsonValue;
    if (dto.wikidataEntityType !== undefined) data.wikidata_entity_type = dto.wikidataEntityType;
    if (dto.reviewPlatforms !== undefined) data.review_platforms = dto.reviewPlatforms as Prisma.InputJsonValue;

    const updated = await this.prisma.vertical.update({ where: { id }, data });

    await this.prisma.verticalConfigAudit.create({
      data: {
        vertical_id: id,
        changed_by_user_id: userId,
        before_config: current as unknown as Prisma.InputJsonValue,
        after_config: updated as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async clone(id: string, dto: CloneVerticalDto, userId: string) {
    const source = await this.findOne(id);

    const existing = await this.prisma.vertical.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug '${dto.slug}' already taken`);

    const cloned = await this.prisma.vertical.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: source.description,
        prompt_templates: source.prompt_templates as Prisma.InputJsonValue,
        intent_categories: source.intent_categories as Prisma.InputJsonValue,
        trusted_domains: source.trusted_domains as Prisma.InputJsonValue,
        aggregator_platforms: source.aggregator_platforms as Prisma.InputJsonValue,
        schema_types: source.schema_types as Prisma.InputJsonValue,
        community_platforms: source.community_platforms as Prisma.InputJsonValue,
        wikidata_entity_type: source.wikidata_entity_type,
        review_platforms: source.review_platforms as Prisma.InputJsonValue,
      },
    });

    await this.prisma.verticalConfigAudit.create({
      data: {
        vertical_id: cloned.id,
        changed_by_user_id: userId,
        before_config: Prisma.JsonNull,
        after_config: cloned as unknown as Prisma.InputJsonValue,
      },
    });

    return cloned;
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.vertical.update({ where: { id }, data: { is_active: false } });
  }

  getAuditLog(id: string) {
    return this.prisma.verticalConfigAudit.findMany({
      where: { vertical_id: id },
      orderBy: { created_at: 'desc' },
    });
  }
}
