import { IsString, Length, Matches } from 'class-validator';

export class CloneVerticalDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug!: string;
}
