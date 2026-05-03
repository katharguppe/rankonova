import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ContentType } from '@prisma/client';

export class GenerateContentDto {
  @IsString()
  clientId!: string;

  @IsEnum(ContentType)
  contentType!: ContentType;

  @IsString()
  @IsOptional()
  targetPromptId?: string;
}
