import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/jwt.strategy';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { QueryPromptsDto } from './dto/query-prompts.dto';

@Injectable()
export class PromptsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
