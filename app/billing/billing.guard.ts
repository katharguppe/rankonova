import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PlanEnforcementService } from './plan-enforcement.service';
import { RequestUser } from '../auth/jwt.strategy';

@Injectable()
export class BillingGuard implements CanActivate {
  constructor(private readonly enforcement: PlanEnforcementService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!request.user) return true; // unauthenticated routes bypass
    await this.enforcement.assertNotSuspended(request.user.tenantId);
    return true;
  }
}
