import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BuyerStage, IntentType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/jwt.strategy';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { QueryPromptsDto } from './dto/query-prompts.dto';
import { QuotaService, QuotaStatus } from './quota.service';

const DEFAULT_PROMPT_TEMPLATES: Record<string, { text: string; category: string; intentType: IntentType }> = {
  purchase_intent_1:  { text: 'Best {category} in {city}?',                              category: 'purchase_intent',  intentType: IntentType.purchase_intent },
  purchase_intent_2:  { text: 'Which {category} should I choose in {city}?',             category: 'purchase_intent',  intentType: IntentType.purchase_intent },
  comparison_1:       { text: '{brand} vs competitors — which is better?',               category: 'comparison',       intentType: IntentType.comparison },
  comparison_2:       { text: '{brand} vs alternatives in {city}',                       category: 'comparison',       intentType: IntentType.comparison },
  local_discovery_1:  { text: 'Top {category} near me in {city}',                        category: 'local_discovery',  intentType: IntentType.local_discovery },
  local_discovery_2:  { text: 'Best {category} provider in {city}',                      category: 'local_discovery',  intentType: IntentType.local_discovery },
  trust_signal_1:     { text: 'Is {brand} reliable and trustworthy?',                    category: 'brand_trust',      intentType: IntentType.trust_signal },
  price_query_1:      { text: '{brand} pricing compared to competitors in {city}',       category: 'price_query',      intentType: IntentType.price_query },
  feature_query_1:    { text: 'Which {category} has best service in {city}?',            category: 'feature_query',    intentType: IntentType.feature_query },
  segment_1:          { text: 'Best {category} for {use_case} in {city}',                category: 'segment_discovery', intentType: IntentType.segment },
};

@Injectable()
export class PromptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
  ) {}

  findAll(query: QueryPromptsDto, user: RequestUser) {
    const isSuperAdmin = user.role === UserRole.super_admin;

    return this.prisma.prompt.findMany({
      where: {
        ...(query.verticalId && { vertical_id: query.verticalId }),
        ...(query.intentType && { intent_type: query.intentType }),
        ...(query.buyerStage && { buyer_stage: query.buyerStage }),
        ...(query.isCustom !== undefined && { is_custom: query.isCustom }),
        is_active: query.isActive ?? true,
        ...(!isSuperAdmin && {
          OR: [{ tenant_id: null }, { tenant_id: user.tenantId }],
        }),
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
    });
  }

  findPlatform(query: QueryPromptsDto) {
    return this.prisma.prompt.findMany({
      where: {
        tenant_id: null,
        is_active: true,
        ...(query.verticalId && { vertical_id: query.verticalId }),
        ...(query.intentType && { intent_type: query.intentType }),
        ...(query.buyerStage && { buyer_stage: query.buyerStage }),
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
    });
  }

  async findOne(id: string, user: RequestUser) {
    const prompt = await this.prisma.prompt.findUnique({ where: { id } });
    if (!prompt || !prompt.is_active) throw new NotFoundException('Prompt not found');

    if (
      user.role !== UserRole.super_admin &&
      prompt.tenant_id !== null &&
      prompt.tenant_id !== user.tenantId
    ) {
      throw new NotFoundException('Prompt not found');
    }

    return prompt;
  }

  async create(dto: CreatePromptDto, user: RequestUser) {
    const isSuperAdmin = user.role === UserRole.super_admin;
    const tenantId = isSuperAdmin ? (dto.tenantId ?? null) : user.tenantId;

    return this.prisma.prompt.create({
      data: {
        text: dto.text,
        category: dto.category,
        intent_type: dto.intentType,
        buyer_stage: dto.buyerStage,
        vertical_id: dto.verticalId ?? null,
        tenant_id: tenantId,
        is_custom: isSuperAdmin ? (dto.isCustom ?? false) : true,
        priority: dto.priority ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdatePromptDto, user: RequestUser) {
    const prompt = await this.findOne(id, user);

    if (user.role !== UserRole.super_admin && prompt.tenant_id === null) {
      throw new ForbiddenException('Cannot modify platform prompts');
    }

    return this.prisma.prompt.update({
      where: { id },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.intentType !== undefined && { intent_type: dto.intentType }),
        ...(dto.buyerStage !== undefined && { buyer_stage: dto.buyerStage }),
        ...(dto.verticalId !== undefined && { vertical_id: dto.verticalId }),
        ...(dto.isCustom !== undefined && { is_custom: dto.isCustom }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
      },
    });
  }

  async getQuota(user: RequestUser): Promise<QuotaStatus> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { plan_tier: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.quotaService.check(user.tenantId, tenant.plan_tier);
  }

  async deactivate(id: string, user: RequestUser) {
    const prompt = await this.findOne(id, user);

    if (user.role !== UserRole.super_admin && prompt.tenant_id === null) {
      throw new ForbiddenException('Cannot deactivate platform prompts');
    }

    return this.prisma.prompt.update({
      where: { id },
      data: { is_active: false },
    });
  }

  async seedDefaultPrompts(verticalId: string, intentCategories: string[]): Promise<void> {
    const categorySet = new Set(intentCategories);
    const templates = Object.values(DEFAULT_PROMPT_TEMPLATES).filter((t) =>
      categorySet.has(t.intentType) || categorySet.has(t.category),
    );

    // Fall back to all 10 if none match (catches unknown/custom categories)
    const selected = templates.length > 0 ? templates : Object.values(DEFAULT_PROMPT_TEMPLATES);

    await this.prisma.prompt.createMany({
      data: selected.map((t) => ({
        text: t.text,
        category: t.category,
        intent_type: t.intentType,
        buyer_stage: BuyerStage.decision,
        vertical_id: verticalId,
        tenant_id: null,
        is_custom: false,
        is_active: true,
        priority: 9,
      })),
      skipDuplicates: true,
    });
  }
}
