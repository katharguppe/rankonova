import { Inject, Injectable } from '@nestjs/common';
import { PlanTier } from '@prisma/client';
import { IRazorpayService } from './razorpay.interface';

@Injectable()
export class BillingService {
  constructor(
    @Inject('RAZORPAY') private readonly razorpay: IRazorpayService,
  ) {}

  // Stubs — full implementation in Task 13
  async createSubscription(_tenantId: string, _planTier: PlanTier): Promise<unknown> {
    throw new Error('Not implemented');
  }

  async cancelSubscription(_tenantId: string): Promise<{ cancelled: true }> {
    throw new Error('Not implemented');
  }

  async changePlan(_tenantId: string, _planTier: PlanTier): Promise<unknown> {
    throw new Error('Not implemented');
  }

  async startTrial(_tenantId: string): Promise<unknown> {
    throw new Error('Not implemented');
  }

  async getStatus(_tenantId: string): Promise<unknown> {
    throw new Error('Not implemented');
  }

  async handleWebhook(_body: Buffer, _signature: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
