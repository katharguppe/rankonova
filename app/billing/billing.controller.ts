import { Controller, Post, Patch, Get, Req, Body, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { RequestUser } from '../auth/jwt.strategy';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('subscribe')
  async subscribe(
    @Req() req: { user: RequestUser },
    @Body() dto: SubscribeDto,
  ) {
    return this.billing.createSubscription(req.user.tenantId, dto.planTier);
  }

  @Post('cancel')
  @HttpCode(200)
  async cancel(@Req() req: { user: RequestUser }) {
    return this.billing.cancelSubscription(req.user.tenantId);
  }

  @Patch('plan')
  async changePlan(
    @Req() req: { user: RequestUser },
    @Body() dto: ChangePlanDto,
  ) {
    return this.billing.changePlan(req.user.tenantId, dto.planTier);
  }

  @Post('trial/start')
  async startTrial(@Req() req: { user: RequestUser }) {
    return this.billing.startTrial(req.user.tenantId);
  }

  @Get('status')
  async getStatus(@Req() req: { user: RequestUser }) {
    return this.billing.getStatus(req.user.tenantId);
  }

  // No JWT guard — HMAC verifies webhook authenticity
  @Post('webhook/razorpay')
  @HttpCode(200)
  async razorpayWebhook(@Req() req: Request) {
    const signature = req.headers['x-razorpay-signature'] as string;
    await this.billing.handleWebhook(req.body as Buffer, signature);
    return { received: true };
  }
}
