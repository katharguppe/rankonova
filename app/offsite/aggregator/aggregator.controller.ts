import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AggregatorService } from './aggregator.service';

@Controller('offsite/aggregator')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AggregatorController {
  constructor(private readonly aggregatorService: AggregatorService) {}

  @Post(':clientId/run')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  run(@Param('clientId') clientId: string) {
    return this.aggregatorService.runForClient(clientId);
  }

  @Get(':clientId/latest')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  latest(@Param('clientId') clientId: string) {
    return this.aggregatorService.getLatestSnapshots(clientId);
  }
}
