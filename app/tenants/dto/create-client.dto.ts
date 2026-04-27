import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  verticalId!: string;

  @IsString()
  @Length(2, 100)
  name!: string;

  @IsString()
  @Length(2, 100)
  brandName!: string;

  @IsArray()
  @IsString({ each: true })
  aliases!: string[];

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsUrl()
  websiteUrl!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  models?: Record<string, unknown>;
}
