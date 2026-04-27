import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

const BCRYPT_ROUNDS = 12;
const INVITE_TTL = 60 * 60 * 48; // 48 h

const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  is_active: true,
  tenant_id: true,
  created_at: true,
  last_login_at: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  listUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: USER_SELECT,
      orderBy: { created_at: 'asc' },
    });
  }

  async getUser(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId, is_active: true },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async inviteUser(
    tenantId: string,
    dto: InviteUserDto,
  ): Promise<{ message: string; inviteToken: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already registered');

    const placeholder = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        tenant_id: tenantId,
        email: dto.email,
        password_hash: placeholder,
        role: dto.role,
        is_active: false,
      },
    });

    const token = randomBytes(32).toString('hex');
    await this.redis.setex(`user_invite:${token}`, INVITE_TTL, user.id);

    // TODO Phase 11: send invite email via SendGrid
    return { message: 'Invite sent', inviteToken: token };
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<{ message: string }> {
    const userId = await this.redis.get(`user_invite:${dto.token}`);
    if (!userId) throw new BadRequestException('Invalid or expired invite token');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: passwordHash, is_active: true },
    });
    await this.redis.del(`user_invite:${dto.token}`);
    return { message: 'Account activated' };
  }

  async updateRole(
    tenantId: string,
    targetUserId: string,
    dto: UpdateUserRoleDto,
    requestingUserId: string,
  ) {
    if (targetUserId === requestingUserId) {
      throw new BadRequestException('Cannot change your own role');
    }
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenant_id: tenantId, is_active: true },
    });
    if (!target) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: dto.role },
      select: { id: true, email: true, role: true },
    });
  }

  async deactivateUser(
    tenantId: string,
    targetUserId: string,
    requestingUserId: string,
  ): Promise<void> {
    if (targetUserId === requestingUserId) {
      throw new BadRequestException('Cannot deactivate your own account');
    }
    const { count } = await this.prisma.user.updateMany({
      where: { id: targetUserId, tenant_id: tenantId, is_active: true },
      data: { is_active: false },
    });
    if (count === 0) throw new NotFoundException('User not found');
  }
}
