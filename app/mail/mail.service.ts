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

  async sendTrialReminder(to: string, daysRemaining: number): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Your AEO Suite trial reminder',
      html: `<p>Your trial ends in <strong>${daysRemaining} days</strong>.</p>
<p>Subscribe now to keep uninterrupted access: <a href="${this.appUrl}/billing">Choose a plan</a></p>`,
    });
  }

  async sendTrialWarning(to: string, daysRemaining: number): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'AEO Suite trial ending soon',
      html: `<p><strong>Only ${daysRemaining} days left</strong> on your AEO Suite trial.</p>
<p>Add a payment method to continue: <a href="${this.appUrl}/billing">Subscribe</a></p>`,
    });
  }

  async sendTrialEnd(to: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Your AEO Suite trial has ended',
      html: `<p>Your 14-day trial has ended. Your account has been downgraded to the Starter plan.</p>
<p>Upgrade to restore full access: <a href="${this.appUrl}/billing">Choose a plan</a></p>`,
    });
  }

  async sendInvoiceEmail(
    to: string,
    paymentId: string,
    amountPaise: number,
    pdf: Buffer,
  ): Promise<void> {
    const amountInr = (amountPaise / 100).toFixed(2);
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `AEO Suite Invoice — INR ${amountInr}`,
      html: `<p>Thank you for your payment of <strong>INR ${amountInr}</strong>.</p>
<p>Payment ID: ${paymentId}</p>
<p>Your invoice is attached.</p>`,
      attachments: [
        {
          filename: `invoice-${paymentId}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });
  }
}
