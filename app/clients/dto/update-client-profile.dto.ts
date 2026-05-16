import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DigitalHandlesDto {
  @IsOptional()
  @IsString()
  linkedin?: string;

  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  youtube?: string;

  @IsOptional()
  @IsString()
  website_secondary?: string;
}

export class UpdateClientProfileDto {
  @IsOptional()
  @Type(() => DigitalHandlesDto)
  @ValidateNested()
  digital_handles?: DigitalHandlesDto;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Brand description must not exceed 500 characters',
  })
  brand_description?: string;

  @IsOptional()
  @IsArray({ message: 'Brand keywords must be an array' })
  @ArrayMaxSize(20, {
    message: 'Brand keywords must not exceed 20 items',
  })
  @IsString({ each: true, message: 'Each keyword must be a string' })
  @MinLength(2, {
    each: true,
    message: 'Each keyword must be at least 2 characters',
  })
  @MaxLength(100, {
    each: true,
    message: 'Each keyword must not exceed 100 characters',
  })
  brand_keywords?: string[];

  @IsOptional()
  @IsArray({ message: 'Competitors known must be an array' })
  @ArrayMaxSize(20, {
    message: 'Competitors known must not exceed 20 items',
  })
  @IsString({ each: true, message: 'Each competitor must be a string' })
  @MinLength(2, {
    each: true,
    message: 'Each competitor must be at least 2 characters',
  })
  @MaxLength(100, {
    each: true,
    message: 'Each competitor must not exceed 100 characters',
  })
  competitors_known?: string[];
}
