import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePromptDto } from './create-prompt.dto';

export class UpdatePromptDto extends PartialType(CreatePromptDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
