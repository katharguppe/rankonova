import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { BuyerStage, IntentType } from '@prisma/client';

export class CreatePromptDto {
  @IsString()
  @Length(5, 1000)
  text!: string;

  @IsString()
  @Length(2, 100)
  category!: string;

  @IsEnum(IntentType)
  intentType!: IntentType;

  @IsEnum(BuyerStage)
  buyerStage!: BuyerStage;

  @IsOptional()
  @IsString()
  verticalId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
