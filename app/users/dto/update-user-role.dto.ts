import { IsIn } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsIn([UserRole.client_manager, UserRole.client_viewer])
  role!: UserRole;
}
