import { IsString, MinLength } from 'class-validator';

export class RequestRevisionDto {
  @IsString()
  @MinLength(10)
  reviewNotes!: string;
}
