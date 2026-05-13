import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlanEnforcementService {
  constructor(private readonly prisma: PrismaService) {}

  async assertNotSuspended(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { billing_suspended: true },
    });
    if (tenant.billing_suspended) {
      throw new HttpException('Account suspended — billing issue', 402);
    }
  }

  async suspendTenant(tenantId: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { billing_suspended: true },
    });
  }

  async unsuspendTenant(tenantId: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { billing_suspended: false },
    });
  }

  async assertWithinQuota(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan_tier: true, prompt_quota_daily: true },
    });
    if (tenant.plan_tier === 'enterprise') return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await this.prisma.promptRun.count({
      where: {
        client: { tenant_id: tenantId },
        created_at: { gte: startOfDay },
      },
    });

    if (count >= tenant.prompt_quota_daily) {
      throw new HttpException('Daily prompt quota exceeded', 429);
    }
  }
}
