# Security Architecture

## The Middlewares Misconception
- **Middleware** acts as a coarse-grained UI bouncer (e.g., redirecting unauthenticated users to `/login`).
- **True Security** lives server-side in the **Service Layer**. A Service must always assume the caller is malicious and re-verify `merchant.accountStatus === ACTIVE`.

## Idempotency
- All state-mutating financial endpoints (e.g., `/api/v1/payouts`) require an `Idempotency-Key` header.
- Handled via a unique constraint in PostgreSQL to prevent double-spending from network retries.\n