import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthEventType } from '@prisma/client';

@Injectable()
export class AuthEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string, eventType: AuthEventType, ip?: string, userAgent?: string): Promise<void> {
    await this.prisma.authEvent.create({
      data: { user_id: userId, event_type: eventType, ip_address: ip, user_agent: userAgent },
    });
  }
}
