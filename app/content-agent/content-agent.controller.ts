import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../auth/jwt.strategy';
import { ContentAgentService } from './content-agent.service';
import { GenerateContentDto } from './dto/generate-content.dto';

@Controller('content')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentAgentController {
  constructor(private readonly contentAgentService: ContentAgentService) {}

  @Post('generate')
  @HttpCode(201)
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  generate(@Body() dto: GenerateContentDto, @Req() req: Request) {
    const user = req.user as RequestUser;
    return this.contentAgentService.generateContent(user.tenantId, dto);
  }

  @Get(':clientId')
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  list(@Param('clientId') clientId: string, @Req() req: Request) {
    const user = req.user as RequestUser;
    return this.contentAgentService.listOutputs(user.tenantId, clientId);
  }

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
}
