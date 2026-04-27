import { IsString, Length } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  @Length(6, 8)
  token!: string;

  @IsString()
  mfaSession!: string;
}
