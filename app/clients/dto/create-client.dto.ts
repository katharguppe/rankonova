import {
  IsString,
  IsArray,
  MinLength,
  MaxLength,
  IsOptional,
  ValidateNested,
  ArrayMaxSize,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DigitalHandlesDto } from './update-client-profile.dto';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  brandName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  state: string;

  @IsString()
  websiteUrl: string;

  @IsArray()
  @IsString({ each: true })
  aliases: string[];

  @IsString()
  verticalId: string;

  // OPTIONAL: Brand profile fields
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
