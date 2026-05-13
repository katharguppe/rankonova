import { IsEnum } from 'class-validator';
import { PlanTier } from '@prisma/client';

export class ChangePlanDto {
  @IsEnum(PlanTier)
  planTier!: PlanTier;
}
