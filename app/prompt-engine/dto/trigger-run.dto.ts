import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { AiEngine } from '@prisma/client';

export class TriggerRunDto {
  @IsString()
  clientId!: string;

  @IsString()
  promptId!: string;

  @IsArray()
  @IsEnum(AiEngine, { each: true })
  @IsOptional()
  engines?: AiEngine[];
}
