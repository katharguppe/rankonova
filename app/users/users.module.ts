import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { CommonModule } from '../common/common.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [CommonModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
