// app/billing/razorpay.interface.ts

export interface RazorpaySubscription {
  id: string;
  status: 'created' | 'active' | 'halted' | 'cancelled';
  planId: string;
  tenantId: string;
  createdAt: number; // unix timestamp
}

export interface RazorpayPaymentResult {
  paymentId: string;
  status: 'captured';
  amount: number; // in paise (INR smallest unit)
}

export type RazorpayWebhookEvent =
  | 'payment.captured'
  | 'subscription.halted'
  | 'subscription.cancelled';

export interface RazorpayWebhookPayload {
  entity: 'event';
  event: RazorpayWebhookEvent;
  payload: Record<string, unknown>;
  created_at: number; // unix timestamp
}

export interface IRazorpayService {
  createSubscription(planId: string, tenantId: string): Promise<RazorpaySubscription>;
  fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription>;
  cancelSubscription(subscriptionId: string): Promise<{ cancelled: true }>;
  capturePayment(paymentId: string, amount: number): Promise<RazorpayPaymentResult>;
  buildWebhookPayload(
    event: RazorpayWebhookEvent,
    data: Record<string, unknown>,
  ): RazorpayWebhookPayload;
}
