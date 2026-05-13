import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async generateAndSend(tenantId: string, paymentId: string, amountPaise: number): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, billing_email: true },
    });
    const pdf = await this.buildPdf(tenant.name, paymentId, amountPaise);
    await this.mail.sendInvoiceEmail(tenant.billing_email, paymentId, amountPaise, pdf);
    await this.prisma.billingEvent.create({
      data: {
        tenant_id: tenantId,
        event_type: 'payment_succeeded',
        amount_inr: amountPaise,
        razorpay_payment_id: paymentId,
      },
    });
  }

  private buildPdf(tenantName: string, paymentId: string, amountPaise: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const amountInr = (amountPaise / 100).toFixed(2);
      doc.fontSize(20).text('AEO Suite Invoice', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Tenant: ${tenantName}`);
      doc.text(`Payment ID: ${paymentId}`);
      doc.text(`Amount: INR ${amountInr}`);
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
      doc.end();
    });
  }
}
