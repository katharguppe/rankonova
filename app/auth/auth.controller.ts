import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';

import { AuthService, REFRESH_COOKIE } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RequestUser } from './jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';

const COOKIE_OPTIONS = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  maxAge,
});

@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AuthController {
  private readonly refreshMaxAge =
    parseInt(process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '2592000') * 1000;

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully' };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, req.ip, req.headers['user-agent']);
    if ('mfaRequired' in result) return result;
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS(this.refreshMaxAge));
    return { accessToken: result.accessToken };
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyMfaChallenge(dto, req.ip, req.headers['user-agent']);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS(this.refreshMaxAge));
    return { accessToken: result.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('No refresh token');
    const result = await this.authService.refresh(raw, req.ip);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS(this.refreshMaxAge));
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as RequestUser;
    const raw = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (raw) await this.authService.logout(user.userId, raw);
    res.clearCookie(REFRESH_COOKIE);
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(@Body() dto: ResetPasswordRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successful' };
  }

  @Post('mfa/enroll')
  @UseGuards(JwtAuthGuard)
  enrollMfa(@Req() req: Request) {
    return this.authService.enrollMfa((req.user as RequestUser).userId);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enableMfa(@Req() req: Request, @Body('token') token: string) {
    await this.authService.enableMfa((req.user as RequestUser).userId, token);
    return { message: 'MFA enabled successfully' };
  }
}
