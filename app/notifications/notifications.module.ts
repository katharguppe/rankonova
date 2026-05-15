import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaModule } from '../prisma/prisma.module';
import { MailService } from '../mail/mail.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RateLimiterService } from './rate-limiter.service';
import { NotificationHandler } from './notification.handler';
import { DigestCronJob } from './digest-cron.job';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    RateLimiterService,
    NotificationHandler,
    DigestCronJob,
    MailService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
    },
  ],
  exports: [NotificationsService, NotificationHandler],
})
export class NotificationsModule {}
