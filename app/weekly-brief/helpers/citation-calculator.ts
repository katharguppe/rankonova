import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CitationCalculator {
  constructor(private readonly prisma: PrismaService) {}

  async calculateCitationScore(clientId: string, weekMonday: Date): Promise<number> {
    const weekStart = this.getWeekStart(weekMonday);
    const weekEnd = this.getWeekEnd(weekMonday);

    const mentions = await this.prisma.brandMention.count({
      where: {
        client_id: clientId,
        is_client_brand: true,
        created_at: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
    });

    const prompts = await this.prisma.promptRun.count({
      where: {
        client_id: clientId,
        ran_at: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
    });

    if (prompts === 0) return 0;
    return Math.round((mentions / prompts) * 100 * 100) / 100;
  }

  async calculateCitationDelta(clientId: string, weekMonday: Date): Promise<number> {
    const thisWeekScore = await this.calculateCitationScore(clientId, weekMonday);

    const prevWeekMonday = new Date(weekMonday);
    prevWeekMonday.setDate(prevWeekMonday.getDate() - 7);

    const prevWeekScore = await this.calculateCitationScore(clientId, prevWeekMonday);

    return Math.round((thisWeekScore - prevWeekScore) * 100) / 100;
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setUTCDate(diff));
    monday.setUTCHours(0, 0, 0, 0);
    return monday;
  }

  private getWeekEnd(date: Date): Date {
    const start = this.getWeekStart(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return end;
  }
}
