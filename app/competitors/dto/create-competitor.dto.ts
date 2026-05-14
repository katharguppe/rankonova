import { IsString, IsOptional, IsArray, IsUrl, MinLength } from "class-validator";

export class CreateCompetitorDto {
  @IsString()
  @MinLength(1)
  verticalId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;
}
