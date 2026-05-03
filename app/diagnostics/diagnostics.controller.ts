import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DiagnosticsService } from './diagnostics.service';

@Controller('diagnostics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  // Triggers the full gap-report pipeline. Returns the stored GapReport.
  // Long-running (~30-60s due to Playwright crawls) — call async from frontend.
  @Post(':clientId/generate')
  @HttpCode(201)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  generateReport(@Param('clientId') clientId: string) {
    return this.diagnosticsService.generateReport(clientId);
  }

  // Returns all versioned reports for a client, latest first.
  @Get(':clientId/reports')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  listReports(@Param('clientId') clientId: string) {
    return this.diagnosticsService.listReports(clientId);
  }

  // Returns the most recent GapReport in full.
  @Get(':clientId/reports/latest')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  async getLatestReport(@Param('clientId') clientId: string) {
    const report = await this.diagnosticsService.getLatestReport(clientId);
    if (!report) throw new NotFoundException(`No gap reports found for client ${clientId}`);
    return report;
  }
}
