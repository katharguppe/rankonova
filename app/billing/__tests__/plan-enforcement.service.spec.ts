import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { PlanEnforcementService } from '../plan-enforcement.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PlanEnforcementService', () => {
  let service: PlanEnforcementService;
  const mockPrisma = {
    tenant: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    promptRun: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PlanEnforcementService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PlanEnforcementService);
  });

  describe('assertNotSuspended', () => {
    it('throws HttpException with status 402 when billing_suspended is true', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ billing_suspended: true });
      const err = await service.assertNotSuspended('t1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(402);
    });

    it('resolves when billing_suspended is false', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ billing_suspended: false });
      await expect(service.assertNotSuspended('t1')).resolves.toBeUndefined();
    });
  });

  describe('suspendTenant', () => {
    it('sets billing_suspended to true', async () => {
      mockPrisma.tenant.update.mockResolvedValue({});
      await service.suspendTenant('t1');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { billing_suspended: true },
      });
    });
  });

  describe('unsuspendTenant', () => {
    it('sets billing_suspended to false', async () => {
      mockPrisma.tenant.update.mockResolvedValue({});
      await service.unsuspendTenant('t1');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { billing_suspended: false },
      });
    });
  });

  describe('assertWithinQuota', () => {
    it('passes when plan_tier is enterprise regardless of run count', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan_tier: 'enterprise', prompt_quota_daily: 0 });
      await expect(service.assertWithinQuota('t1')).resolves.toBeUndefined();
      expect(mockPrisma.promptRun.count).not.toHaveBeenCalled();
    });

    it('throws 429 when daily run count meets or exceeds quota', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan_tier: 'starter', prompt_quota_daily: 500 });
      mockPrisma.promptRun.count.mockResolvedValue(500);
      const err = await service.assertWithinQuota('t1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(429);
    });

    it('passes when daily run count is under quota', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ plan_tier: 'starter', prompt_quota_daily: 500 });
      mockPrisma.promptRun.count.mockResolvedValue(499);
      await expect(service.assertWithinQuota('t1')).resolves.toBeUndefined();
    });
  });
});
