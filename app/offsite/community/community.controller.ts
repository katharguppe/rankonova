import {
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ResponseStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CommunityService } from './community.service';

@Controller('offsite/community')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post(':clientId/run')
  @HttpCode(200)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  run(@Param('clientId') clientId: string) {
    return this.communityService.runForClient(clientId);
  }

  @Get(':clientId/threads')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  threads(
    @Param('clientId') clientId: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('opportunities_only') opportunitiesOnly?: string,
  ) {
    const responseStatus = status as ResponseStatus | undefined;
    const opOnly = opportunitiesOnly === 'true';
    return this.communityService.getThreads(clientId, platform, responseStatus, opOnly);
  }

  @Post('thread/:id/draft')
  @HttpCode(200)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  regenerateDraft(@Param('id') id: string) {
    return this.communityService.regenerateDraft(id);
  }

  @Patch('thread/:id/posted')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  markPosted(@Param('id') id: string) {
    return this.communityService.markPosted(id);
  }

  @Patch('thread/:id/skipped')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  markSkipped(@Param('id') id: string) {
    return this.communityService.markSkipped(id);
  }
}
