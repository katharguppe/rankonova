import { Inject, Injectable } from '@nestjs/common';
import { IRazorpayService } from './razorpay.interface';

@Injectable()
export class BillingService {
  constructor(
    @Inject('RAZORPAY') private readonly razorpay: IRazorpayService,
  ) {}
}
