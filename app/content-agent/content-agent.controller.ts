import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ContentStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../auth/jwt.strategy';
import { ContentAgentService } from './content-agent.service';
import { GenerateContentDto } from './dto/generate-content.dto';
import { RequestRevisionDto } from './dto/request-revision.dto';

@Controller('content')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentAgentController {
  constructor(private readonly contentAgentService: ContentAgentService) {}

  // ── generation ────────────────────────────────────────────────────────────────

  @Post('generate')
  @HttpCode(201)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  generate(@Body() dto: GenerateContentDto, @Req() req: Request) {
    const user = req.user as RequestUser;
    return this.contentAgentService.generateContent(user.tenantId, dto);
  }

  // ── approval workflow ─────────────────────────────────────────────────────────

  @Patch('output/:id/approve')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  approve(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as RequestUser;
    return this.contentAgentService.approveOutput(user.tenantId, id, user.userId);
  }

  @Patch('output/:id/request-revision')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  requestRevision(
    @Param('id') id: string,
    @Body() dto: RequestRevisionDto,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    return this.contentAgentService.requestRevision(user.tenantId, id, dto.reviewNotes);
  }

  @Post('output/:id/regenerate')
  @HttpCode(201)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  regenerate(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as RequestUser;
    return this.contentAgentService.regenerateOutput(user.tenantId, id);
  }

  @Patch('output/:id/publish')
  @Roles(UserRole.super_admin, UserRole.tenant_admin)
  publish(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as RequestUser;
    return this.contentAgentService.publishOutput(user.tenantId, id);
  }

  // ── read ──────────────────────────────────────────────────────────────────────

  @Get('output/:id')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  async getOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as RequestUser;
    const output = await this.contentAgentService.getOutput(user.tenantId, id);
    if (!output) throw new NotFoundException(`ContentOutput ${id} not found`);
    return output;
  }

  @Get(':clientId')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  list(
    @Param('clientId') clientId: string,
    @Query('status') status: ContentStatus | undefined,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    return this.contentAgentService.listOutputs(user.tenantId, clientId, status);
  }
}
