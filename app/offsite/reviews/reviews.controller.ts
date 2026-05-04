import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReviewsService } from './reviews.service';

@Controller('offsite/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':clientId/run')
  @HttpCode(200)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  run(@Param('clientId') clientId: string) {
    return this.reviewsService.runForClient(clientId);
  }

  @Get(':clientId/latest')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  latest(@Param('clientId') clientId: string) {
    return this.reviewsService.getLatestAudits(clientId);
  }

  @Get(':clientId/snapshots')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  snapshots(
    @Param('clientId') clientId: string,
    @Query('platform') platform?: string,
    @Query('is_negative') isNegative?: string,
  ) {
    const neg = isNegative === undefined ? undefined : isNegative === 'true';
    return this.reviewsService.getSnapshots(clientId, platform, neg);
  }

  @Post(':clientId/request-kit')
  @HttpCode(200)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  generateKit(@Param('clientId') clientId: string) {
    return this.reviewsService.generateRequestKit(clientId);
  }

  @Get(':clientId/request-kit')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  async getKit(@Param('clientId') clientId: string) {
    const kit = await this.reviewsService.getRequestKit(clientId);
    if (!kit) throw new NotFoundException(`No request kit found for client ${clientId} — generate one first`);
    return kit;
  }

  @Post('snapshot/:id/draft')
  @HttpCode(200)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  generateDraft(@Param('id') id: string) {
    return this.reviewsService.generateResponseDraft(id);
  }
}
