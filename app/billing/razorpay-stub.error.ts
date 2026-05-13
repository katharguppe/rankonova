// app/billing/razorpay-stub.error.ts

export class RazorpayStubError extends Error {
  constructor(public readonly code: string) {
    super(`RazorpayStub: ${code}`);
    this.name = 'RazorpayStubError';
  }
}
