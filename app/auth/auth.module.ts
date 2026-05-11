import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';

import { PrismaModule } from '../prisma/prisma.module';
import { MailService } from '../mail/mail.service';
import { AuthController } from './auth.controller';
import { AuthEventsService } from './auth-events.service';
import { AuthService } from './auth.service';
import { EncryptionService } from './encryption.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LockoutService } from './lockout.service';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    JwtModule.registerAsync({
      useFactory: () => ({
        privateKey: Buffer.from(process.env['JWT_PRIVATE_KEY'] ?? '', 'base64').toString(),
        publicKey: Buffer.from(process.env['JWT_PUBLIC_KEY'] ?? '', 'base64').toString(),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: parseInt(process.env['JWT_EXPIRES_IN'] ?? '86400'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    AuthEventsService,
    EncryptionService,
    JwtStrategy,
    JwtAuthGuard,
    LockoutService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
    },
  ],
  exports: [AuthService, JwtAuthGuard, JwtStrategy, EncryptionService],
})
export class AuthModule {}
