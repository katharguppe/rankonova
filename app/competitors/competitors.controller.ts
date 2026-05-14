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
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/jwt.strategy';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateCompetitorDto } from './dto/create-competitor.dto';
import { UpdateCompetitorDto } from './dto/update-competitor.dto';
import { CompetitorsService } from './competitors.service';

@Controller('competitors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompetitorsController {
  constructor(private readonly competitorsService: CompetitorsService) {}

  @Post()
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCompetitorDto, @Req() req: Request) {
    const user = req.user as RequestUser;
    return this.competitorsService.create(
      user.tenantId,
      dto.verticalId,
      dto.name,
      dto.aliases,
      dto.websiteUrl,
    );
  }

  @Get()
  @Roles(
    UserRole.super_admin,
    UserRole.tenant_admin,
    UserRole.client_manager,
    UserRole.client_viewer,
  )
  list(@Req() req: Request, @Query('verticalId') verticalId?: string, @Query('isActive') isActive?: string) {
    const user = req.user as RequestUser;
    const active = isActive === 'false' ? false : true;
    return this.competitorsService.list(user.tenantId, verticalId, active);
  }

  @Patch(':id')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompetitorDto,
    @Req() req: Request,
  ) {
    const user = req.user as RequestUser;
    return this.competitorsService.update(id, user.tenantId, {
      name: dto.name,
      aliases: dto.aliases,
      websiteUrl: dto.websiteUrl,
      isActive: dto.isActive,
    });
  }

  @Delete(':id')
  @Roles(UserRole.super_admin, UserRole.tenant_admin, UserRole.client_manager)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as RequestUser;
    return this.competitorsService.delete(id, user.tenantId);
  }
}
