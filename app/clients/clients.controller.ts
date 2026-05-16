import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../auth/jwt.strategy';
import { ClientsService } from './clients.service';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';
import { CreateClientDto } from './dto/create-client.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@Req() req: Request) {
    const user = req.user as RequestUser;
    return this.clientsService.findAllForTenant(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as RequestUser;
    return this.clientsService.findOne(id, user.tenantId);
  }

  @Post()
  async create(@Body() dto: CreateClientDto, @Req() req: Request) {
    const user = req.user as RequestUser;
    return this.clientsService.createClient(user.tenantId, dto);
  }

  @Patch(':id/profile')
  async updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateClientProfileDto,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    return this.clientsService.updateClientProfile(id, user.tenantId, dto);
  }
}
