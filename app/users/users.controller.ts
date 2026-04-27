import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/jwt.strategy';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // /me must be declared before /:id to avoid routing conflict

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: Request) {
    return this.usersService.getMe((req.user as RequestUser).userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.tenant_admin)
  listUsers(@Req() req: Request) {
    return this.usersService.listUsers((req.user as RequestUser).tenantId);
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.tenant_admin)
  inviteUser(@Req() req: Request, @Body() dto: InviteUserDto) {
    return this.usersService.inviteUser((req.user as RequestUser).tenantId, dto);
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.usersService.acceptInvite(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.tenant_admin)
  getUser(@Req() req: Request, @Param('id') id: string) {
    return this.usersService.getUser((req.user as RequestUser).tenantId, id);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.tenant_admin)
  updateRole(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    const u = req.user as RequestUser;
    return this.usersService.updateRole(u.tenantId, id, dto, u.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.tenant_admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateUser(@Req() req: Request, @Param('id') id: string) {
    const u = req.user as RequestUser;
    return this.usersService.deactivateUser(u.tenantId, id, u.userId);
  }
}
