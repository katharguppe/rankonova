import { Test } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';

import { MailService } from './mail.service';

jest.mock('nodemailer');

describe('MailService', () => {
  let service: MailService;
  let mockSendMail: jest.Mock;

  beforeEach(async () => {
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: mockSendMail });

    process.env['SMTP_HOST'] = 'smtp.example.com';
    process.env['SMTP_PORT'] = '587';
    process.env['SMTP_USER'] = 'user@example.com';
    process.env['SMTP_PASS'] = 'testpass';
    process.env['SMTP_FROM'] = 'noreply@example.com';
    process.env['APP_URL'] = 'http://localhost:3000';

    const module = await Test.createTestingModule({ providers: [MailService] }).compile();
    service = module.get<MailService>(MailService);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates transporter with SMTP env vars', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      auth: { user: 'user@example.com', pass: 'testpass' },
    });
  });

  it('sends verification email to the correct address with token in link', async () => {
    await service.sendVerificationEmail('recipient@example.com', 'abc123token');

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@example.com',
        to: 'recipient@example.com',
        subject: expect.stringContaining('Verify'),
        html: expect.stringContaining('abc123token'),
      }),
    );
  });

  it('includes a clickable verification link in the email body', async () => {
    await service.sendVerificationEmail('user@test.com', 'tok999');

    const call = mockSendMail.mock.calls[0][0] as { html: string };
    expect(call.html).toContain('http://localhost:3000/auth/verify-email?token=tok999');
  });

  it('propagates transporter errors to the caller', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(service.sendVerificationEmail('u@u.com', 'tok')).rejects.toThrow(
      'SMTP connection refused',
    );
  });
});
