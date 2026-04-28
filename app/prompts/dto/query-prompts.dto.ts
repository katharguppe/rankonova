import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BuyerStage, IntentType } from '@prisma/client';

export class QueryPromptsDto {
  @IsOptional()
  @IsString()
  verticalId?: string;

  @IsOptional()
  @IsEnum(IntentType)
  intentType?: IntentType;

  @IsOptional()
  @IsEnum(BuyerStage)
  buyerStage?: BuyerStage;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true')
  @IsBoolean()
  isCustom?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
