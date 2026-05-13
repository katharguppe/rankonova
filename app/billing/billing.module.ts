import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { RazorpayStubService } from './razorpay-stub.service';

@Module({
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
  ],
  exports: [BillingService],
})
export class BillingModule {}
