# Idempotency

- All state-mutating financial endpoints (e.g., `/api/v1/payouts`) require an `Idempotency-Key` header.
- Enforced via unique database constraints on `Payout.merchantId + Payout.idempotencyKey` to guarantee that a network retry never results in a double-charge.\n