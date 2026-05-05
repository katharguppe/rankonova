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
import { PrSignalStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrService } from './pr.service';

@Controller('offsite/pr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrController {
  constructor(private readonly prService: PrService) {}

  @Post(':clientId/run')
  @HttpCode(200)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  run(@Param('clientId') clientId: string) {
    return this.prService.runForClient(clientId);
  }

  @Get(':clientId/signals')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  signals(
    @Param('clientId') clientId: string,
    @Query('status') status?: string,
  ) {
    const prStatus = status as PrSignalStatus | undefined;
    return this.prService.getSignals(clientId, prStatus);
  }

  @Patch('signal/:id/approve')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  approve(@Param('id') id: string) {
    return this.prService.approveSignal(id);
  }

  @Patch('signal/:id/distribute')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  distribute(@Param('id') id: string) {
    return this.prService.markDistributed(id);
  }

  @Patch('signal/:id/archive')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  archive(@Param('id') id: string) {
    return this.prService.archiveSignal(id);
  }

  @Post('signal/:id/pickup-check')
  @HttpCode(200)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  pickupCheck(@Param('id') id: string) {
    return this.prService.runPickupCheck(id);
  }
}
