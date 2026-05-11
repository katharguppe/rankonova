import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthEventType } from '@prisma/client';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthEventsService } from './auth-events.service';
import { EncryptionService } from './encryption.service';
import { LockoutService } from './lockout.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';

const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFY_TTL = 60 * 60 * 48; // 48 h
const MFA_SESSION_TTL = 60 * 5;        // 5 min
const PWD_RESET_TTL = 60 * 60;         // 1 h
const REFRESH_COOKIE = 'refresh_token';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly lockout: LockoutService,
    private readonly authEvents: AuthEventsService,
    private readonly encryption: EncryptionService,
    private readonly mail: MailService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // ── Registration ───────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{ message: string; verificationToken: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const slugTaken = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    if (slugTaken) throw new ConflictException('Tenant slug already taken');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const verificationToken = randomBytes(32).toString('hex');

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, slug: dto.tenantSlug, billing_email: dto.billingEmail },
      });
      return tx.user.create({
        data: { tenant_id: tenant.id, email: dto.email, password_hash: passwordHash, role: 'tenant_admin' },
      });
    });

    await this.redis.setex(`email_verify:${verificationToken}`, EMAIL_VERIFY_TTL, user.id);
    await this.redis.setex(`user_unverified:${user.id}`, EMAIL_VERIFY_TTL, '1');

    await this.mail.sendVerificationEmail(user.email, verificationToken);
    return { message: 'Registration successful. Check your email to verify your account.', verificationToken };
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.redis.get(`email_verify:${token}`);
    if (!userId) throw new BadRequestException('Invalid or expired verification token');
    await this.redis.del(`email_verify:${token}`, `user_unverified:${userId}`);
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<TokenPair | { mfaRequired: true; mfaSession: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.is_active) throw new UnauthorizedException('Invalid credentials');

    if (this.lockout.isLocked(user.locked_until)) {
      throw new ForbiddenException(`Account locked until ${user.locked_until!.toISOString()}`);
    }

    const unverified = await this.redis.get(`user_unverified:${user.id}`);
    if (unverified) throw new ForbiddenException('Email not verified. Check your inbox.');

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) {
      const { nowLocked } = await this.lockout.recordFailure(user.id);
      if (nowLocked) await this.authEvents.log(user.id, AuthEventType.account_locked, ip, userAgent);
      await this.authEvents.log(user.id, AuthEventType.login_failure, ip, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.lockout.clearFailures(user.id);
    await this.prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } });

    if (user.mfa_enabled) {
      const mfaSession = randomBytes(32).toString('hex');
      await this.redis.setex(`mfa_session:${mfaSession}`, MFA_SESSION_TTL, user.id);
      return { mfaRequired: true, mfaSession };
    }

    await this.authEvents.log(user.id, AuthEventType.login_success, ip, userAgent);
    return this.issueTokenPair(user.id, user.tenant_id, user.role);
  }

  // ── MFA ───────────────────────────────────────────────────────────────────

  async verifyMfaChallenge(dto: MfaVerifyDto, ip?: string, userAgent?: string): Promise<TokenPair> {
    const userId = await this.redis.get(`mfa_session:${dto.mfaSession}`);
    if (!userId) throw new UnauthorizedException('MFA session expired');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfa_secret) throw new UnauthorizedException('MFA not configured');

    const secret = this.encryption.decrypt(user.mfa_secret);
    if (!authenticator.check(dto.token, secret)) {
      await this.authEvents.log(userId, AuthEventType.mfa_challenge_failure, ip, userAgent);
      throw new UnauthorizedException('Invalid MFA token');
    }

    await this.redis.del(`mfa_session:${dto.mfaSession}`);
    await this.authEvents.log(userId, AuthEventType.mfa_challenge_success, ip, userAgent);
    await this.authEvents.log(userId, AuthEventType.login_success, ip, userAgent);
    return this.issueTokenPair(user.id, user.tenant_id, user.role);
  }

  async enrollMfa(userId: string): Promise<{ secret: string; qrDataUrl: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new UnauthorizedException();

    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfa_secret: this.encryption.encrypt(secret) },
    });

    const otpauthUrl = authenticator.keyuri(user.email, 'AEO Suite', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, qrDataUrl, otpauthUrl };
  }

  async enableMfa(userId: string, token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfa_secret) throw new BadRequestException('MFA not enrolled. Call /auth/mfa/enroll first.');

    if (!authenticator.check(token, this.encryption.decrypt(user.mfa_secret))) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { mfa_enabled: true } });
    await this.authEvents.log(userId, AuthEventType.mfa_enabled);
  }

  // ── Token management ───────────────────────────────────────────────────────

  async refresh(rawToken: string, ip?: string): Promise<TokenPair> {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { token_hash: hash } });

    if (!stored || stored.is_revoked || stored.expires_at < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.user_id } });
    if (!user || !user.is_active) throw new UnauthorizedException();

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { is_revoked: true } });
    await this.authEvents.log(user.id, AuthEventType.token_refreshed, ip);
    return this.issueTokenPair(user.id, user.tenant_id, user.role);
  }

  async logout(userId: string, rawToken: string): Promise<void> {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, token_hash: hash, is_revoked: false },
      data: { is_revoked: true },
    });
    await this.authEvents.log(userId, AuthEventType.logout);
  }

  // ── Password reset ─────────────────────────────────────────────────────────

  async requestPasswordReset(dto: ResetPasswordRequestDto): Promise<{ resetToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) return { resetToken: '' }; // don't leak whether email exists

    const token = randomBytes(32).toString('hex');
    await this.redis.setex(`pwd_reset:${token}`, PWD_RESET_TTL, user.id);
    await this.authEvents.log(user.id, AuthEventType.password_reset_requested);
    // TODO Phase 11: send reset email via SendGrid
    return { resetToken: token };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const userId = await this.redis.get(`pwd_reset:${dto.resetToken}`);
    if (!userId) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { password_hash: passwordHash } });
    await this.prisma.refreshToken.updateMany({ where: { user_id: userId }, data: { is_revoked: true } });
    await this.redis.del(`pwd_reset:${dto.resetToken}`);
    await this.authEvents.log(userId, AuthEventType.password_reset_completed);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async issueTokenPair(userId: string, tenantId: string, role: string): Promise<TokenPair> {
    const accessToken = this.jwtService.sign({ sub: userId, tenant_id: tenantId, role, type: 'access' });

    const rawRefresh = randomBytes(64).toString('hex');
    const refreshHash = createHash('sha256').update(rawRefresh).digest('hex');
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + parseInt(process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '2592000'),
    );

    await this.prisma.refreshToken.create({
      data: { user_id: userId, token_hash: refreshHash, expires_at: expiresAt },
    });

    return { accessToken, refreshToken: rawRefresh };
  }
}

export { REFRESH_COOKIE };
