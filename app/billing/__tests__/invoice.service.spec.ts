import { Test } from '@nestjs/testing';
import { InvoiceService } from '../invoice.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(function (this: any, event: string, cb: (chunk?: Buffer) => void) {
      if (event === 'end') setImmediate(() => cb());
      return this;
    }),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    end: jest.fn(function (this: any) {
      const endCb = this.on.mock.calls.find((c: string[]) => c[0] === 'end')?.[1];
      if (endCb) endCb();
    }),
  }));
});

describe('InvoiceService', () => {
  let service: InvoiceService;
  const mockPrisma = {
    tenant: { findUniqueOrThrow: jest.fn() },
    billingEvent: { create: jest.fn() },
  };
  const mockMail = { sendInvoiceEmail: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();
    service = module.get(InvoiceService);
  });

  it('fetches tenant, calls sendInvoiceEmail, and writes payment_succeeded event', async () => {
    mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({
      name: 'Acme Corp',
      billing_email: 'billing@acme.com',
    });
    mockMail.sendInvoiceEmail.mockResolvedValue(undefined);
    mockPrisma.billingEvent.create.mockResolvedValue({});

    await service.generateAndSend('t1', 'pay_abc', 500000);

    expect(mockMail.sendInvoiceEmail).toHaveBeenCalledWith(
      'billing@acme.com',
      'pay_abc',
      500000,
      expect.any(Buffer),
    );
    expect(mockPrisma.billingEvent.create).toHaveBeenCalledWith({
      data: {
        tenant_id: 't1',
        event_type: 'payment_succeeded',
        amount_inr: 500000,
        razorpay_payment_id: 'pay_abc',
      },
    });
  });
});
