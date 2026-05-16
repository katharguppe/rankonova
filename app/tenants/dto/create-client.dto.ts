import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ArrayMaxSize,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DigitalHandlesDto {
  @IsOptional() @IsString() linkedin?: string;
  @IsOptional() @IsString() twitter?: string;
  @IsOptional() @IsString() instagram?: string;
  @IsOptional() @IsString() youtube?: string;
  @IsOptional() @IsString() website_secondary?: string;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => DigitalHandlesDto)
  digital_handles?: DigitalHandlesDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brand_description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(100, { each: true })
  brand_keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(100, { each: true })
  competitors_known?: string[];
}
