import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/jwt.strategy';
import { QuotaService } from './quota.service';

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly quotaService: QuotaService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user: RequestUser }>();
    const res = context.switchToHttp().getResponse<Response>();
    const { tenantId } = req.user;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan_tier: true },
    });

    if (!tenant) {
      throw new HttpException('Tenant not found', HttpStatus.UNAUTHORIZED);
    }

    const status = await this.quotaService.check(tenantId, tenant.plan_tier);
    const resetEpoch = String(Math.floor(status.resetAt.getTime() / 1000));

    res.setHeader('X-RateLimit-Limit', status.limit === Infinity ? 'unlimited' : String(status.limit));
    res.setHeader(
      'X-RateLimit-Remaining',
      status.limit === Infinity ? 'unlimited' : String(Math.max(0, status.limit - status.count)),
    );
    res.setHeader('X-RateLimit-Reset', resetEpoch);

    if (!status.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Daily prompt quota exceeded',
          resetAt: status.resetAt.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.quotaService.increment(tenantId);
    return true;
  }
}
