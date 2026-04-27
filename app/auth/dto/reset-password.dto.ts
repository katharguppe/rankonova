import { IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  resetToken!: string;

  @IsString()
  @Length(8, 72)
  newPassword!: string;
}
