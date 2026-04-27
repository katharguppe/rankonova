import { IsEmail, IsIn } from 'class-validator';
import { UserRole } from '@prisma/client';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsIn([UserRole.client_manager, UserRole.client_viewer])
  role!: UserRole;
}
