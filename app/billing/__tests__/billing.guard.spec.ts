import { Test } from '@nestjs/testing';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { BillingGuard } from '../billing.guard';
import { PlanEnforcementService } from '../plan-enforcement.service';

function makeContext(tenantId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: tenantId ? { tenantId } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('BillingGuard', () => {
  let guard: BillingGuard;
  const mockEnforcement = { assertNotSuspended: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        BillingGuard,
        { provide: PlanEnforcementService, useValue: mockEnforcement },
      ],
    }).compile();
    guard = module.get(BillingGuard);
  });

  it('returns true when tenant is not suspended', async () => {
    mockEnforcement.assertNotSuspended.mockResolvedValue(undefined);
    const result = await guard.canActivate(makeContext('tenant-1'));
    expect(result).toBe(true);
    expect(mockEnforcement.assertNotSuspended).toHaveBeenCalledWith('tenant-1');
  });

  it('returns true when no user on request (unauthenticated routes handle this separately)', async () => {
    const result = await guard.canActivate(makeContext(undefined));
    expect(result).toBe(true);
    expect(mockEnforcement.assertNotSuspended).not.toHaveBeenCalled();
  });

  it('rethrows HttpException from assertNotSuspended', async () => {
    mockEnforcement.assertNotSuspended.mockRejectedValue(new HttpException('suspended', 402));
    await expect(guard.canActivate(makeContext('t1'))).rejects.toThrow(HttpException);
  });
});
