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
import { CreateVerticalDto } from './dto/create-vertical.dto';
import { UpdateVerticalDto } from './dto/update-vertical.dto';
import { CloneVerticalDto } from './dto/clone-vertical.dto';
import { VerticalsService } from './verticals.service';

@Controller('verticals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerticalsController {
  constructor(private readonly verticalsService: VerticalsService) {}

  @Get()
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  findAll() {
    return this.verticalsService.findAll();
  }

  @Get(':id')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  findOne(@Param('id') id: string) {
    return this.verticalsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.super_admin)
  create(@Body() dto: CreateVerticalDto) {
    return this.verticalsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin)
  update(@Param('id') id: string, @Body() dto: UpdateVerticalDto, @Req() req: Request) {
    return this.verticalsService.update(id, dto, (req.user as RequestUser).userId);
  }

  @Post(':id/clone')
  @Roles(UserRole.super_admin)
  clone(@Param('id') id: string, @Body() dto: CloneVerticalDto, @Req() req: Request) {
    return this.verticalsService.clone(id, dto, (req.user as RequestUser).userId);
  }

  @Delete(':id')
  @Roles(UserRole.super_admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id') id: string) {
    return this.verticalsService.deactivate(id);
  }

  @Get(':id/audit')
  @Roles(UserRole.super_admin)
  getAuditLog(@Param('id') id: string) {
    return this.verticalsService.getAuditLog(id);
  }
}
