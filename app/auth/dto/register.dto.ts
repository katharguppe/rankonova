import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 72)
  password!: string;

  @IsString()
  @Length(2, 100)
  tenantName!: string;

  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers, and hyphens only' })
  tenantSlug!: string;

  @IsEmail()
  billingEmail!: string;
}
