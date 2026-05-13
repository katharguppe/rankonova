import { IsEnum } from 'class-validator';
import { PlanTier } from '@prisma/client';

export class SubscribeDto {
  @IsEnum(PlanTier)
  planTier!: PlanTier;
}
