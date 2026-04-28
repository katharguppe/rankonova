import { IsArray, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateVerticalDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  promptTemplates!: string[];

  @IsArray()
  @IsString({ each: true })
  intentCategories!: string[];

  @IsArray()
  @IsString({ each: true })
  trustedDomains!: string[];

  @IsArray()
  aggregatorPlatforms!: Record<string, unknown>[];

  @IsArray()
  @IsString({ each: true })
  schemaTypes!: string[];

  @IsArray()
  communityPlatforms!: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  wikidataEntityType?: string;

  @IsArray()
  reviewPlatforms!: Record<string, unknown>[];
}
