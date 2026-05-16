import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IntentType, BuyerStage } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/jwt.strategy';

const AGENT_PROMPT_COUNT = parseInt(process.env['AGENT_PROMPT_COUNT'] ?? '25', 10);

interface GeneratedPrompt {
  text: string;
  category: string;
  intent_type: string;
  buyer_stage: string;
  priority: number;
}

@Injectable()
export class AgentPromptGeneratorService {
  private readonly logger = new Logger(AgentPromptGeneratorService.name);
  private readonly anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.anthropic = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
  }

  async generateForClient(
    clientId: string,
    user: RequestUser,
  ): Promise<{ generated: number; promptIds?: string[] } | { skipped: boolean; reason: string }> {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        is_active: true,
        deleted_at: null,
        ...(user.role !== 'super_admin' ? { tenant_id: user.tenantId } : {}),
      },
    });
    if (!client) throw new NotFoundException('Client not found');

    const existing = await this.prisma.prompt.count({
      where: { client_id: clientId, source: 'agent' },
    });
    if (existing >= AGENT_PROMPT_COUNT) {
      return { skipped: true, reason: 'prompts already generated' };
    }

    if (!client.brand_description) {
      throw new BadRequestException('brand_description is required to generate agent prompts');
    }

    const vertical = await this.prisma.vertical.findUnique({ where: { id: client.vertical_id } });
    const verticalName = vertical?.name ?? 'general';

    const keywords = Array.isArray(client.brand_keywords) ? (client.brand_keywords as string[]).join(', ') : '';
    const handles = client.digital_handles ? JSON.stringify(client.digital_handles) : 'none';

    const userMessage = `Generate exactly ${AGENT_PROMPT_COUNT} diverse search prompts that real users would type into an AI assistant when looking for a business in the "${verticalName}" vertical.

Brand context:
- Description: ${client.brand_description}
- Keywords to rank for: ${keywords}
- Digital handles: ${handles}

Requirements:
- Cover all 8 intent types: purchase_intent, comparison, feature_query, ownership, segment, local_discovery, trust_signal, price_query
- Cover all 4 buyer stages: awareness, consideration, decision, retention
- Make prompts realistic and specific to the brand context
- Use the store_prompts tool to return all ${AGENT_PROMPT_COUNT} prompts`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [
        {
          name: 'store_prompts',
          description: 'Store the generated prompts array',
          input_schema: {
            type: 'object' as const,
            properties: {
              prompts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    category: { type: 'string' },
                    intent_type: {
                      type: 'string',
                      enum: Object.values(IntentType),
                    },
                    buyer_stage: {
                      type: 'string',
                      enum: Object.values(BuyerStage),
                    },
                    priority: { type: 'number' },
                  },
                  required: ['text', 'category', 'intent_type', 'buyer_stage', 'priority'],
                },
              },
            },
            required: ['prompts'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'store_prompts' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === 'store_prompts');
    if (!toolUse || toolUse.type !== 'tool_use') {
      this.logger.warn(`AgentPromptGenerator: no tool_use block in Claude response for client ${clientId}`);
      return { generated: 0 };
    }

    const prompts = (toolUse.input as { prompts: GeneratedPrompt[] }).prompts;
    if (!prompts?.length) {
      this.logger.warn(`AgentPromptGenerator: empty prompts array for client ${clientId}`);
      return { generated: 0 };
    }

    if (prompts.length < AGENT_PROMPT_COUNT) {
      this.logger.warn(
        `AgentPromptGenerator: Claude returned ${prompts.length} prompts (expected ${AGENT_PROMPT_COUNT}) for client ${clientId}`,
      );
    }

    await this.prisma.prompt.createMany({
      data: prompts.map((p) => ({
        text: p.text,
        category: p.category,
        intent_type: p.intent_type as IntentType,
        buyer_stage: p.buyer_stage as BuyerStage,
        priority: p.priority,
        is_custom: true,
        source: 'agent',
        client_id: clientId,
        tenant_id: client.tenant_id,
        vertical_id: client.vertical_id,
        is_active: true,
      })),
      skipDuplicates: true,
    });

    const saved = await this.prisma.prompt.findMany({
      where: { client_id: clientId, source: 'agent' },
      select: { id: true },
    });

    return { generated: saved.length, promptIds: saved.map((p) => p.id) };
  }
}
