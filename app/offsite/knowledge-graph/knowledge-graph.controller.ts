import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { KnowledgeGraphService } from './knowledge-graph.service';

@Controller('offsite/knowledge-graph')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeGraphController {
  constructor(private readonly knowledgeGraphService: KnowledgeGraphService) {}

  @Post(':clientId/run')
  @HttpCode(200)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  run(@Param('clientId') clientId: string) {
    return this.knowledgeGraphService.runForClient(clientId);
  }

  @Get(':clientId/latest')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  latest(@Param('clientId') clientId: string) {
    return this.knowledgeGraphService.getLatestCheck(clientId);
  }

  @Get(':clientId/history')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  history(@Param('clientId') clientId: string) {
    return this.knowledgeGraphService.getCheckHistory(clientId);
  }
}
