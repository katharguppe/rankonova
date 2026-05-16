import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AgentPromptGeneratorService } from './agent-prompt-generator.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock the Anthropic SDK module
jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

import Anthropic from '@anthropic-ai/sdk';

const mockPrisma = {
  client: { findFirst: jest.fn() },
  prompt: { count: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  vertical: { findUnique: jest.fn() },
};

const TENANT_USER = { userId: 'u1', tenantId: 'tenant1', role: 'tenant_admin' as const };

const mockClient = {
  id: 'c1',
  tenant_id: 'tenant1',
  vertical_id: 'v1',
  brand_description: 'We sell premium cars in Pune',
  brand_keywords: ['SUV', 'luxury', 'Pune'],
  digital_handles: { linkedin: 'https://linkedin.com/company/acme' },
};

const mockVertical = { id: 'v1', name: 'automotive' };

const mockClaudePrompts = Array.from({ length: 25 }, (_, i) => ({
  text: `Which SUV should I buy in Pune ${i + 1}?`,
  category: 'purchase',
  intent_type: 'purchase_intent',
  buyer_stage: 'consideration',
  priority: 5,
}));

describe('AgentPromptGeneratorService', () => {
  let service: AgentPromptGeneratorService;
  let anthropicInstance: { messages: { create: jest.Mock } };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentPromptGeneratorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AgentPromptGeneratorService>(AgentPromptGeneratorService);
    anthropicInstance = (Anthropic as unknown as jest.Mock).mock.results[0].value;
    jest.clearAllMocks();
  });

  it('generates and saves 25 prompts for a client with brand_description', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(mockClient);
    mockPrisma.prompt.count.mockResolvedValue(0);
    mockPrisma.vertical.findUnique.mockResolvedValue(mockVertical);
    anthropicInstance.messages.create.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'store_prompts',
          input: { prompts: mockClaudePrompts },
        },
      ],
    });
    mockPrisma.prompt.createMany.mockResolvedValue({ count: 25 });
    mockPrisma.prompt.findMany.mockResolvedValue(mockClaudePrompts.map((_, i) => ({ id: `p${i}` })));

    const result = await service.generateForClient('c1', TENANT_USER) as { generated: number; promptIds?: string[] };

    expect(result.generated).toBe(25);
    expect((result as any).skipped).toBeUndefined();
    expect(mockPrisma.prompt.createMany).toHaveBeenCalledTimes(1);
    const createArgs = mockPrisma.prompt.createMany.mock.calls[0][0];
    expect(createArgs.data[0]).toMatchObject({
      is_custom: true,
      source: 'agent',
      client_id: 'c1',
      tenant_id: 'tenant1',
      vertical_id: 'v1',
    });
  });

  it('returns skipped:true when >= 25 agent prompts already exist for the client', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(mockClient);
    mockPrisma.prompt.count.mockResolvedValue(25);

    const result = await service.generateForClient('c1', TENANT_USER);

    expect(result).toEqual({ skipped: true, reason: 'prompts already generated' });
    expect(anthropicInstance.messages.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when client does not exist', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(null);

    await expect(service.generateForClient('bad-id', TENANT_USER))
      .rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when brand_description is missing', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ ...mockClient, brand_description: null });
    mockPrisma.prompt.count.mockResolvedValue(0);

    await expect(service.generateForClient('c1', TENANT_USER))
      .rejects.toThrow(BadRequestException);
  });
});
