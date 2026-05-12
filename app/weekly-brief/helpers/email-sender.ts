import { Injectable, Logger } from '@nestjs/common';

interface SendGridPayload {
  personalizations: Array<{
    to: string | Array<{ email: string; name?: string }>;
  }>;
  from: string | { email: string; name?: string };
  subject: string;
  html: string;
}

@Injectable()
export class EmailSender {
  private readonly logger = new Logger(EmailSender.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;

  constructor() {
    this.apiKey = process.env['SENDGRID_API_KEY'] || '';
    this.fromEmail = process.env['SENDGRID_FROM_EMAIL'] || 'briefs@aeo-suite.local';

    if (!this.apiKey) {
      this.logger.warn('SENDGRID_API_KEY not set; email sending will fail');
    }
  }

  async sendBrief(clientEmail: string, clientName: string, htmlContent: string): Promise<{ id: string }> {
    const payload: SendGridPayload = {
      personalizations: [
        {
          to: [{ email: clientEmail, name: clientName }],
        },
      ],
      from: {
        email: this.fromEmail,
        name: 'AEO Suite',
      },
      subject: `Your AEO Weekly Brief - ${this.getCurrentWeekLabel()}`,
      html: htmlContent,
    };

    return this.sendViaApi(payload);
  }

  private async sendViaApi(payload: SendGridPayload): Promise<{ id: string }> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid failed: ${response.status} ${error}`);
      }

      const msgId = response.headers.get('x-message-id') || 'unknown';
      this.logger.log(`Email sent: ${msgId}`);

      return { id: msgId };
    } catch (err) {
      this.logger.error(`EmailSender failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private getCurrentWeekLabel(): string {
    const now = new Date();
    const weekStart = this.getMonday(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
}
