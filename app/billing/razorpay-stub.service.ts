// app/billing/razorpay-stub.service.ts

import { Injectable } from '@nestjs/common';
import {
  IRazorpayService,
  RazorpaySubscription,
  RazorpayPaymentResult,
  RazorpayWebhookEvent,
  RazorpayWebhookPayload,
} from './razorpay.interface';
import { RazorpayStubError } from './razorpay-stub.error';

function stubId(prefix: string): string {
  return `${prefix}_stub_${Math.random().toString(36).slice(2, 10)}`;
}

@Injectable()
export class RazorpayStubService implements IRazorpayService {
  async createSubscription(
    planId: string,
    tenantId: string,
  ): Promise<RazorpaySubscription> {
    if (Math.random() >= 0.7) {
      throw new RazorpayStubError('subscription_creation_failed');
    }
    return {
      id: stubId('sub'),
      status: 'created',
      planId,
      tenantId,
      createdAt: Math.floor(Date.now() / 1000),
    };
  }

  async fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
    if (Math.random() >= 0.95) {
      throw new RazorpayStubError('subscription_not_found');
    }
    return {
      id: subscriptionId,
      status: Math.random() < 0.9 ? 'active' : 'halted',
      planId: 'plan_stub',
      tenantId: 'tenant_stub',
      createdAt: Math.floor(Date.now() / 1000),
    };
  }

  async cancelSubscription(_subscriptionId: string): Promise<{ cancelled: true }> {
    return { cancelled: true };
  }

  async capturePayment(
    paymentId: string,
    amount: number,
  ): Promise<RazorpayPaymentResult> {
    if (Math.random() >= 0.6) {
      throw new RazorpayStubError('payment_failed');
    }
    return { paymentId, status: 'captured', amount };
  }

  buildWebhookPayload(
    event: RazorpayWebhookEvent,
    data: Record<string, unknown>,
  ): RazorpayWebhookPayload {
    return {
      entity: 'event',
      event,
      payload: data,
      created_at: Math.floor(Date.now() / 1000),
    };
  }
}
