import { Test, TestingModule } from '@nestjs/testing';
import { EmailSender } from '../helpers/email-sender';

describe('EmailSender', () => {
  let emailSender: EmailSender;

  beforeEach(async () => {
    process.env['SENDGRID_API_KEY'] = 'test-key-123';
    process.env['SENDGRID_FROM_EMAIL'] = 'briefs@aeo-suite.local';

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailSender],
    }).compile();

    emailSender = module.get<EmailSender>(EmailSender);
  });

  it('should send brief email via SendGrid', async () => {
    const clientEmail = 'demo@aeo-suite.local';
    const clientName = 'Test Motors';
    const html = '<h1>Test Brief</h1>';

    const sendSpy = jest.spyOn(emailSender as any, 'sendViaApi').mockResolvedValue({
      id: 'test-msg-id',
    });

    const result = await emailSender.sendBrief(clientEmail, clientName, html);

    expect(result).toEqual({ id: 'test-msg-id' });
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        personalizations: expect.arrayContaining([
          expect.objectContaining({
            to: expect.arrayContaining([
              expect.objectContaining({ email: clientEmail }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('should format email with subject and from address', async () => {
    const clientEmail = 'demo@aeo-suite.local';
    const clientName = 'Test Motors';
    const html = '<h1>Test</h1>';

    const sendSpy = jest.spyOn(emailSender as any, 'sendViaApi').mockResolvedValue({ id: 'msg-id' });

    await emailSender.sendBrief(clientEmail, clientName, html);

    const call = sendSpy.mock.calls[0][0] as any;
    expect(call.subject).toContain('Weekly Brief');
    expect(call.from.email).toBe('briefs@aeo-suite.local');
    expect(call.from.name).toBe('AEO Suite');
  });
});
