import { IsEnum } from 'class-validator';
import { PlanTier } from '@prisma/client';

export class UpdateTenantPlanDto {
  @IsEnum(PlanTier)
  planTier!: PlanTier;
}
