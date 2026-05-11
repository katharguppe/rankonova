import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AiEngine } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CostTrackerService } from './cost/cost-tracker.service';
import { PromptEngineService } from './prompt-engine.service';
import { PromptRunQueueService } from './queue/prompt-run.queue';

const mockPrisma = {
  client: { findFirst: jest.fn() },
  prompt: { findMany: jest.fn() },
};

const mockQueue = { enqueue: jest.fn() };
const mockCostTracker = { getDailyCostUsd: jest.fn() };

const TENANT_USER = { userId: 'u1', tenantId: 'tenant1', role: 'tenant_admin' };
const SUPER_USER = { userId: 'u2', tenantId: 'tenant1', role: 'super_admin' };

describe('PromptEngineService.triggerClientRun', () => {
  let service: PromptEngineService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PromptEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PromptRunQueueService, useValue: mockQueue },
        { provide: CostTrackerService, useValue: mockCostTracker },
      ],
    }).compile();

    service = module.get<PromptEngineService>(PromptEngineService);
    jest.clearAllMocks();
  });

  const mockClient = { id: 'c1', tenant_id: 'tenant1', vertical_id: 'v1' };
  const mockPrompts = [{ id: 'p1' }, { id: 'p2' }];
  const DEFAULT_ENGINES = [AiEngine.chatgpt, AiEngine.perplexity, AiEngine.gemini, AiEngine.claude];

  it('enqueues all active prompts for the client across 4 default engines', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(mockClient);
    mockPrisma.prompt.findMany.mockResolvedValue(mockPrompts);
    mockQueue.enqueue
      .mockResolvedValueOnce(['r1', 'r2', 'r3', 'r4'])
      .mockResolvedValueOnce(['r5', 'r6', 'r7', 'r8']);

    const result = await service.triggerClientRun('c1', TENANT_USER);

    expect(mockQueue.enqueue).toHaveBeenCalledTimes(2);
    expect(mockQueue.enqueue).toHaveBeenCalledWith('p1', 'c1', 'tenant1', DEFAULT_ENGINES);
    expect(mockQueue.enqueue).toHaveBeenCalledWith('p2', 'c1', 'tenant1', DEFAULT_ENGINES);
    expect(result.enqueued).toBe(8);
    expect(result.runIds).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']);
  });

  it('queries prompts scoped to the client vertical including platform prompts', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(mockClient);
    mockPrisma.prompt.findMany.mockResolvedValue([]);
    mockQueue.enqueue.mockResolvedValue([]);

    await service.triggerClientRun('c1', TENANT_USER);

    expect(mockPrisma.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vertical_id: 'v1',
          is_active: true,
        }),
      }),
    );
  });

  it('returns enqueued=0 and empty runIds when client has no active prompts', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(mockClient);
    mockPrisma.prompt.findMany.mockResolvedValue([]);

    const result = await service.triggerClientRun('c1', TENANT_USER);

    expect(mockQueue.enqueue).not.toHaveBeenCalled();
    expect(result).toEqual({ enqueued: 0, runIds: [] });
  });

  it('throws NotFoundException when client does not exist or belongs to another tenant', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(null);

    await expect(service.triggerClientRun('missing', TENANT_USER)).rejects.toThrow(NotFoundException);
  });

  it('super_admin can trigger runs for any tenant client', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ ...mockClient, tenant_id: 'other-tenant' });
    mockPrisma.prompt.findMany.mockResolvedValue([{ id: 'p1' }]);
    mockQueue.enqueue.mockResolvedValue(['r1', 'r2', 'r3', 'r4']);

    const result = await service.triggerClientRun('c1', SUPER_USER);

    expect(result.enqueued).toBe(4);
  });
});
