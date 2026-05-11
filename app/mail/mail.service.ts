import { Injectable } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly appUrl: string;

  constructor() {
    this.transporter = createTransport({
      host: process.env['SMTP_HOST'],
      port: parseInt(process.env['SMTP_PORT'] ?? '587'),
      auth: {
        user: process.env['SMTP_USER'],
        pass: process.env['SMTP_PASS'],
      },
    });
    this.from = process.env['SMTP_FROM'] ?? '';
    this.appUrl = process.env['APP_URL'] ?? 'http://localhost:3000';
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.appUrl}/auth/verify-email?token=${token}`;
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Verify your AEO Suite account',
      html: `<p>Please click the link below to verify your email address:</p>
<p><a href="${link}">${link}</a></p>
<p>This link expires in 48 hours.</p>`,
    });
  }
}
