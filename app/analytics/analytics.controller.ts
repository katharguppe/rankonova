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
}
