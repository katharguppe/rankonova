import { createHmac } from 'crypto';

export function signWebhookPayload(secret: string, body: string | Buffer): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}
