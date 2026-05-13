import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { SubscriptionService } from './subscription.service';
import { TrialService } from './trial.service';
import { InvoiceService } from './invoice.service';
import { WebhookService } from './webhook.service';
import { PlanEnforcementService } from './plan-enforcement.service';
import { BillingGuard } from './billing.guard';
import { RazorpayStubService } from './razorpay-stub.service';
import { TrialProcessor } from './processors/trial.processor';
import { PaymentRetryProcessor } from './processors/payment-retry.processor';
import { TenantPurgeProcessor } from './processors/tenant-purge.processor';
import { MailService } from '../mail/mail.service';
import {
  BILLING_TRIAL_QUEUE,
  BILLING_RETRY_QUEUE,
  BILLING_PURGE_QUEUE,
} from './billing.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: BILLING_TRIAL_QUEUE },
      { name: BILLING_RETRY_QUEUE },
      { name: BILLING_PURGE_QUEUE },
    ),
  ],
  controllers: [BillingController],
  providers: [
    {
      provide: 'RAZORPAY',
      useFactory: () => {
        // Swap: set RAZORPAY_STUB=false once live keys are available
        if (process.env.RAZORPAY_STUB !== 'false') {
          return new RazorpayStubService();
        }
        // RazorpayLiveService will be added in a future task when keys arrive
        throw new Error('Live Razorpay service not yet implemented. Set RAZORPAY_STUB=true.');
      },
    },
    BillingService,
    SubscriptionService,
    TrialService,
    InvoiceService,
    WebhookService,
    PlanEnforcementService,
    BillingGuard,
    MailService,
    TrialProcessor,
    PaymentRetryProcessor,
    TenantPurgeProcessor,
  ],
  exports: [BillingService],
})
export class BillingModule {}
