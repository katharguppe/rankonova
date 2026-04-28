import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/jwt.strategy';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { QueryPromptsDto } from './dto/query-prompts.dto';
import { PromptsService } from './prompts.service';

@Controller('prompts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Get()
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  findAll(@Query() query: QueryPromptsDto, @Req() req: Request) {
    return this.promptsService.findAll(query, req.user as RequestUser);
  }

  // static route must be before :id to avoid param capture
  @Get('platform')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  findPlatform(@Query() query: QueryPromptsDto) {
    return this.promptsService.findPlatform(query);
  }

  @Get(':id')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager, UserRole.client_viewer)
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.promptsService.findOne(id, req.user as RequestUser);
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.tenant_admin)
  create(@Body() dto: CreatePromptDto, @Req() req: Request) {
    return this.promptsService.create(dto, req.user as RequestUser);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin, UserRole.tenant_admin)
  update(@Param('id') id: string, @Body() dto: UpdatePromptDto, @Req() req: Request) {
    return this.promptsService.update(id, dto, req.user as RequestUser);
  }

  @Delete(':id')
  @Roles(UserRole.super_admin, UserRole.tenant_admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id') id: string, @Req() req: Request) {
    return this.promptsService.deactivate(id, req.user as RequestUser);
  }
}
