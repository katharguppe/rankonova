import { Controller, Post, Body, Logger } from '@nestjs/common';
import { WeeklyBriefService } from './weekly-brief.service';

@Controller('weekly-brief')
export class WeeklyBriefController {
  private readonly logger = new Logger(WeeklyBriefController.name);

  constructor(private readonly weeklyBriefService: WeeklyBriefService) {}

  @Post('generate')
  async generateForClient(@Body() body: { client_id: string; week_of?: string }): Promise<{ success: boolean }> {
    const { client_id, week_of } = body;
    const weekMonday = week_of ? new Date(week_of) : this.getMonday(new Date());

    this.logger.log(`Manual trigger: generate brief for client ${client_id} for week ${weekMonday.toISOString()}`);

    try {
      await this.weeklyBriefService.generateBriefForClient(client_id, weekMonday);
      return { success: true };
    } catch (err) {
      this.logger.error(`Failed: ${(err as Error).message}`);
      throw err;
    }
  }

  @Post('generate-all')
  async generateForAllClients(@Body() body?: { week_of?: string }): Promise<{ success: boolean }> {
    const weekMonday = body?.week_of ? new Date(body.week_of) : this.getMonday(new Date());

    this.logger.log(`Manual trigger: generate briefs for all clients for week ${weekMonday.toISOString()}`);

    try {
      await this.weeklyBriefService.generateWeeklyBriefs(weekMonday);
      return { success: true };
    } catch (err) {
      this.logger.error(`Failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
}
