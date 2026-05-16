import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/jwt.strategy';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TriggerRunDto } from './dto/trigger-run.dto';
import { PromptEngineService } from './prompt-engine.service';
import { AgentPromptGeneratorService } from './agent-prompt-generator.service';

@Controller('prompt-engine')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromptEngineController {
  constructor(
    private readonly service: PromptEngineService,
    private readonly agentPromptGenerator: AgentPromptGeneratorService,
  ) {}

  @Post('clients/:clientId/generate-prompts')
  @Roles(UserRole.super_admin, UserRole.tenant_admin)
  generateAgentPrompts(@Param('clientId') clientId: string, @Req() req: Request) {
    return this.agentPromptGenerator.generateForClient(clientId, req.user as RequestUser);
  }

  @Post('clients/:clientId/run-all')
  @Roles(UserRole.super_admin, UserRole.tenant_admin)
  triggerClientRun(@Param('clientId') clientId: string, @Req() req: Request) {
    return this.service.triggerClientRun(clientId, req.user as RequestUser);
  }

  @Post('run')
  @Roles(UserRole.super_admin, UserRole.tenant_admin)
  trigger(@Body() dto: TriggerRunDto, @Req() req: Request) {
    return this.service.triggerRun(dto, req.user as RequestUser);
  }

  @Get('runs/:runId')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  getRunStatus(@Param('runId') runId: string, @Req() req: Request) {
    return this.service.getRunStatus(runId, req.user as RequestUser);
  }

  @Get('queue/stats')
  @Roles(UserRole.super_admin)
  getQueueStats(@Req() req: Request) {
    return this.service.getQueueStats(req.user as RequestUser);
  }

  @Post('queue/flush')
  @Roles(UserRole.super_admin, UserRole.tenant_admin)
  flushQueue(@Req() req: Request) {
    return this.service.flushWaiting(req.user as RequestUser);
  }

  @Get('cost')
  @Roles(UserRole.super_admin, UserRole.tenant_admin)
  getDailyCost(@Req() req: Request, @Query('date') date?: string) {
    return this.service.getDailyCost(req.user as RequestUser, date);
  }
}
