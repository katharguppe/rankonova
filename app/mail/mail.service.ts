import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { NotificationResponseDto, DigestEmailPayload } from '../notifications/notifications.types';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly appUrl: string;
  private readonly logger = new Logger(MailService.name);

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

  /**
   * Send a notification email for Critical severity notifications
   * Renders HTML email with notification details and deep link
   */
  async sendNotificationEmail(
    notification: NotificationResponseDto,
    _tenantId: string,
  ): Promise<void> {
    // In a production system, would fetch tenant branding and client email here
    // For now, using placeholder email from notification
    const to = 'support@aeo-suite.local'; // TODO: Get from client profile

    const html = this.renderNotificationEmail(notification);

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: notification.title,
      html,
    });

    this.logger.log(
      `Sent notification email: type=${notification.type}, to=${to}`,
    );
  }

  /**
   * Send a digest email with batched HIGH severity notifications
   * Called by DigestCronJob daily at 9 AM IST
   * Groups multiple notifications per client into a single email
   */
  async sendDigestEmail(payload: DigestEmailPayload): Promise<void> {
    // In a production system, would fetch client email and tenant branding here
    const to = 'support@aeo-suite.local'; // TODO: Get from client profile

    const html = this.renderDigestEmail(payload);

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `AEO Suite Daily Digest — ${payload.notifications.length} notifications`,
      html,
    });

    this.logger.log(
      `Sent digest email: clientId=${payload.clientId}, tenantId=${payload.tenantId}, notifications=${payload.notifications.length}`,
    );
  }

  /**
   * Render HTML email for digest batch
   */
  private renderDigestEmail(payload: DigestEmailPayload): string {
    const notifItems = payload.notifications
      .map(
        (n) => `
      <div style="border-left: 4px solid #f57c00; padding: 15px; margin: 10px 0; background-color: #fafafa;">
        <h3 style="margin: 0 0 10px 0; color: #333;">${n.title}</h3>
        <p style="margin: 0 0 10px 0; color: #666;">${n.body || 'No additional details.'}</p>
        ${n.deepLink ? `<a href="${this.appUrl}${n.deepLink}" style="color: #0066cc; text-decoration: none; font-weight: bold;">View Details →</a>` : ''}
      </div>
    `,
      )
      .join('');

    return `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
            .digest-count { font-size: 14px; opacity: 0.9; }
            .footer { padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Daily Digest</h1>
              <p class="digest-count">${payload.notifications.length} notification${payload.notifications.length > 1 ? 's' : ''}</p>
            </div>
            <div style="padding: 20px;">
              ${notifItems}
              <div class="footer">
                <p>This digest was sent on ${payload.sentAt.toLocaleString()}.</p>
                <p><a href="${this.appUrl}/notifications" style="color: #0066cc;">View all notifications →</a></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Render HTML email for a notification
   */
  private renderNotificationEmail(notification: NotificationResponseDto): string {
    return `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; border: 1px solid #ddd; }
            .severity-critical { border-left: 4px solid #d32f2f; }
            .severity-high { border-left: 4px solid #f57c00; }
            .severity-medium { border-left: 4px solid #fbc02d; }
            .cta { display: inline-block; background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; margin-top: 10px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${notification.title}</h1>
              <p>Severity: ${notification.severity.toUpperCase()}</p>
            </div>
            <div class="content severity-${notification.severity}">
              <p>${notification.body || 'No additional details.'}</p>
              ${notification.deepLink ? `<a href="${this.appUrl}${notification.deepLink}" class="cta">View Details</a>` : ''}
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
