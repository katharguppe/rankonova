import { PartialType } from '@nestjs/mapped-types';
import { CreateVerticalDto } from './create-vertical.dto';

export class UpdateVerticalDto extends PartialType(CreateVerticalDto) {}
