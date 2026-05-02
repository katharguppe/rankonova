import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(':clientId/citation-overview')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  getCitationOverview(@Param('clientId') clientId: string) {
    return this.analyticsService.getCitationOverview(clientId);
  }

  @Get(':clientId/share-of-voice')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  getShareOfVoice(@Param('clientId') clientId: string) {
    return this.analyticsService.getShareOfVoice(clientId);
  }

  @Get(':clientId/sentiment')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  getSentiment(@Param('clientId') clientId: string) {
    return this.analyticsService.getSentiment(clientId);
  }

  @Get(':clientId/prompts')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  getPrompts(@Param('clientId') clientId: string) {
    return this.analyticsService.getPrompts(clientId);
  }

  @Get(':clientId/engines')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  getEngines(@Param('clientId') clientId: string) {
    return this.analyticsService.getEngines(clientId);
  }

  @Get(':clientId/sources')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  getSources(@Param('clientId') clientId: string) {
    return this.analyticsService.getSources(clientId);
  }

  @Get(':clientId/geo')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  getGeo(@Param('clientId') clientId: string) {
    return this.analyticsService.getGeo(clientId);
  }
}
