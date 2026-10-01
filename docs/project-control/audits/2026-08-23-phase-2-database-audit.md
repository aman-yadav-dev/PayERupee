# Phase 2 Database & Transaction Audit
**Date:** 2026-08-23

## A. Database Architecture Summary
The system relies on PostgreSQL managed via Prisma. The architecture enforces strict referential integrity (`onDelete: Restrict` for financial entities). It employs a robust double-entry ledger design where a single table (`LedgerEntry`) atomically couples the debit and credit legs of any monetary movement.

## B. Financial Models and Constraints
- **Wallet**: Uses an integer `version` field for Optimistic Concurrency Control (OCC). **Missing DB-level Constraint**: `CHECK (balance >= 0)`.
- **LedgerAccount**: Uniqueness on `[merchantProfileId, type, currency]` prevents duplicate accounts.
- **LedgerEntry**: Uniqueness on `[payoutId, purpose]` natively blocks duplicate Principal or Fee entries for a given payout.
- **Payout**: Uniqueness on `[merchantProfileId, idempotencyKey]` physically prevents duplicate idempotent requests.
- **OutboxEvent**: `referenceId` is `@unique`.

## C. Transaction Boundaries
- **Payout Creation**: Simple insert, catches `P2002` for idempotency.
- **Processing (Debit)**: `db.$transaction` encompassing payout status check -> status update (`where status: PENDING`) -> LedgerEntry creation -> Wallet OCC balance adjustment -> OutboxEvent creation. **Zero network calls inside transaction.**
- **Success / Refund**: `db.$transaction` encompassing payout status check (`where status: PROCESSING`) -> update -> Wallet OCC adjustment -> LedgerEntry creation. **Zero network calls inside transaction.**

## D. Financial Invariants
1. **Ledger entries cannot create money from nothing**: **[DATABASE-PROVEN]** (Structurally enforced by `amount`, `debitAccountId`, and `creditAccountId` sharing a single row).
2. **Wallet balance cannot become invalid through concurrent updates**: **[DATABASE-PROVEN]** (Enforced by `version` in the `where` clause, throwing `P2025` on race).
3. **Wallet cannot overdraft**: **[APPLICATION-PROVEN]** (Enforced by pre-check logic. No DB `CHECK` constraint exists).
4. **Refunds cannot execute twice**: **[DATABASE-PROVEN]** (Enforced by `where: { status: PayoutStatus.PROCESSING }`).
5. **SUCCESS cannot execute twice**: **[DATABASE-PROVEN]** (Enforced by `where: { status: PayoutStatus.PROCESSING }`).
6. **A payout cannot transition illegally**: **[DATABASE-PROVEN]** (Enforced by strict `where` clauses on all state mutations).
7. **One payout cannot accidentally create multiple outbox events**: **[DATABASE-PROVEN]** (`referenceId` @unique).
8. **Idempotency cannot accidentally create duplicate payouts**: **[DATABASE-PROVEN]** (`@@unique([merchantProfileId, idempotencyKey])`).
9. **Orphan ledger records cannot be created**: **[DATABASE-PROVEN]** (`onDelete: Restrict`).

## E. Concurrency Findings
- **Wallet Debit/Refund**: Protected by `wallet.version`.
- **Duplicate Webhooks / Reconciler Races**: Protected by `Payout` status transitions throwing `P2025` / `IllegalStateTransitionError` if another process gets there first.
- **Outbox Worker Races**: Protected by atomic `updateMany` with `lockedUntil` time-bounding. Only one worker can claim `count === 1`.
- **Reconciler Leader Election**: Protected by `SystemLease` UPSERT semantics.

## F. Money/Precision Findings
- **Database**: `Decimal(18, 4)` is used for all monetary fields.
- **JavaScript**: Exact math is done via `Decimal.js` (`.add()`, `.mul()`).
- **Network Serialization**: `parseFloat()` is used in `cashfree.provider.ts` to convert `Decimal` to JSON numbers (Cashfree requirement). This is safe for transmission but correctly isolated from internal DB arithmetic.

## G. Migration/Deployment Findings
- Production relies on `prisma/migrations/`.
- **WARNING**: Tests (`src/tests/setup.ts`) use `npx prisma db push`. This command bypasses migration history entirely. If manual SQL constraints (like `CHECK (balance >= 0)`) are added to migrations, tests will silently ignore them and drift from production behavior.

## H. Proven Protections
- AT-MOST-ONCE application dispatch.
- Atomic double-entry ledger insertion.
- Complete idempotency at the REST layer.

## I. Test-Verified Protections
- Synchronous SUCCESS processing.
- Timeouts resolving via Reconciler.
- OCC enforcement on wallet debits.

## J. Unsafe Findings
- An administrator executing manual SQL updates on `wallets` could push a balance negative, as there is no DB-level `CHECK` constraint.

## K. Unknowns
- Cashfree duplicate handling & `NOT_FOUND` definition.

## L. Not-Proven Claims
- Exactly-once provider execution.

## M. Recommended Database Changes
1. Create a raw SQL migration to add `ALTER TABLE wallets ADD CONSTRAINT check_balance_non_negative CHECK (balance >= 0);`.
2. Update `src/tests/setup.ts` to use `prisma migrate deploy` instead of `prisma db push`.

## N. Risks of Recommended Changes
- Switching to `migrate deploy` in parallel tests requires isolated `shadowDatabaseUrl` setups, which may significantly slow down test initialization or cause CI flakiness.

## O. Files that would need modification IF approved
- `prisma/migrations/`
- `src/tests/setup.ts`

## P. Files that must remain untouched
- `prisma/schema.prisma` (Prisma does not support native `CHECK` constraints).
- Application domain services.

## Q. Whether database implementation is required
- **Not strictly required** for production safety, because the application layer's OCC mathematically prevents race-condition overdrafts. However, the DB-level constraint is recommended for defense-in-depth against manual admin errors.

## R. Dependency impact on later phases
- If test setup changes are mandated, CI/CD pipeline validation will be required in a subsequent infrastructure phase.
