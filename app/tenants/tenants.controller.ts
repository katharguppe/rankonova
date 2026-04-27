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
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // ── /me routes must be declared before /:id ──────────────────────────────

  @Get('me')
  @Roles(UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  getMyTenant(@Req() req: Request) {
    return this.tenantsService.getMyTenant((req.user as RequestUser).tenantId);
  }

  @Patch('me')
  @Roles(UserRole.tenant_admin)
  updateMyTenant(@Req() req: Request, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.updateMyTenant((req.user as RequestUser).tenantId, dto);
  }

  @Post('me/clients')
  @Roles(UserRole.tenant_admin)
  createClient(@Req() req: Request, @Body() dto: CreateClientDto) {
    return this.tenantsService.createClient((req.user as RequestUser).tenantId, dto);
  }

  @Get('me/clients')
  @Roles(UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  getClients(@Req() req: Request) {
    return this.tenantsService.getClients((req.user as RequestUser).tenantId);
  }

  @Get('me/clients/:clientId')
  @Roles(UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  getClient(@Req() req: Request, @Param('clientId') clientId: string) {
    return this.tenantsService.getClient((req.user as RequestUser).tenantId, clientId);
  }

  @Patch('me/clients/:clientId')
  @Roles(UserRole.tenant_admin, UserRole.client_manager)
  updateClient(
    @Req() req: Request,
    @Param('clientId') clientId: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.tenantsService.updateClient(
      (req.user as RequestUser).tenantId,
      clientId,
      dto,
    );
  }

  @Delete('me/clients/:clientId')
  @Roles(UserRole.tenant_admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  softDeleteClient(@Req() req: Request, @Param('clientId') clientId: string) {
    return this.tenantsService.softDeleteClient(
      (req.user as RequestUser).tenantId,
      clientId,
    );
  }

  // ── Super-admin cross-tenant routes (:id must come after /me) ────────────

  @Get()
  @Roles(UserRole.super_admin)
  getAllTenants() {
    return this.tenantsService.getAllTenants();
  }

  @Get(':id')
  @Roles(UserRole.super_admin)
  getTenantById(@Param('id') id: string) {
    return this.tenantsService.getTenantById(id);
  }

  @Patch(':id/plan')
  @Roles(UserRole.super_admin)
  @HttpCode(HttpStatus.OK)
  changePlan(@Param('id') id: string, @Body() dto: UpdateTenantPlanDto) {
    return this.tenantsService.changePlan(id, dto.planTier);
  }
}
