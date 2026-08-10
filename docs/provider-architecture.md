# Provider Agnostic Architecture

PayERupee is structurally designed to support any payout provider (Razorpay, Cashfree, ICICI, etc.) without altering internal financial math.

## The Contract (`IPayoutProvider`)

All providers must implement a strict TypeScript interface:

```typescript
export interface IPayoutProvider {
  dispatch(payout: PayoutDispatchInput): Promise<ProviderDispatchResponse>;
  status(providerReference: string): Promise<ProviderStatusResponse>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
}
```

## Provider Mapping Responsibilities

Providers are solely responsible for translation, not logic.

1. **Request Translation:** Convert `PaymentMode.IMPS` and `payout.accountNumber` to the provider's specific JSON schema.
2. **Idempotency Key:** Ensure `payout.id` is sent as the exact external idempotency key.
3. **Status Normalization:** Map provider-specific statuses (e.g., `processed`, `bounced`, `reversed`) directly back to the PayERupee strict ENUM: `SUCCESS`, `FAILED`, `REVERSED`.
4. **Error Mapping:** Standardize network timeouts versus validation rejections.

## Webhooks

Providers receive varied webhooks. The Webhook controller passes the raw string and headers to `provider.verifyWebhookSignature()`. Cryptographic HMAC validation is entirely offloaded to the Provider class.

If validation passes, the Provider class returns a normalized event mapped to `SUCCESS`, `FAILED`, or `REVERSED`. PayERupee's core state-machine handles the actual financial ledger impacts.
