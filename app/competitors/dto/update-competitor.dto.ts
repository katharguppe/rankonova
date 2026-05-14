import { IsString, IsOptional, IsArray, IsUrl, IsBoolean, MinLength } from "class-validator";

export class UpdateCompetitorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
