import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class LockoutService {
  constructor(private readonly prisma: PrismaService) {}

  isLocked(lockedUntil: Date | null): boolean {
    return !!lockedUntil && lockedUntil > new Date();
  }

  async recordFailure(userId: string): Promise<{ nowLocked: boolean }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failed_login_count: { increment: 1 } },
      select: { failed_login_count: true },
    });

    if (user.failed_login_count >= MAX_FAILURES) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_MINUTES);
      await this.prisma.user.update({
        where: { id: userId },
        data: { locked_until: lockedUntil },
      });
      return { nowLocked: true };
    }

    return { nowLocked: false };
  }

  async clearFailures(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failed_login_count: 0, locked_until: null },
    });
  }
}
