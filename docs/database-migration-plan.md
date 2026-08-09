# Phase 1: Database Migration Plan

## 1. Schema Overview
**Target Schema State:** Decoupled `MerchantProfile`, true double-entry `LedgerAccount` / `LedgerEntry`.

## 2. Model-by-Model Mapping
1. **`User`**: Keep Better Auth fields (`id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`). Keep `role` (`ADMIN`, `MERCHANT`). Remove domain fields.
2. **`Wallet`**: Connect directly to `LedgerAccount` via `ledgerAccountId`. Keep `version` for optimistic locking.
3. **`Payout`**: Enforce `@@unique([merchantProfileId, idempotencyKey])`. 
   - `totalDebitAmount` = `amount + fee + tax` (Renamed from `netAmount` for explicit clarity on deduction).
4. **`WalletTransaction`**: REMOVE.
5. **`MerchantProfile`**: NEW (1:1 with User). `phone` is E.164 and unique (nullable).
6. **`LedgerAccount`**: NEW. Handles Cardinality: `@@unique([merchantProfileId, type, currency])`. System accounts have `merchantProfileId = null` (relying on PostgreSQL NULL distinctness and a static seed script to prevent duplicates).
7. **`LedgerEntry`**: NEW. Immutable. Enforces amount > 0 and debitAccountId != creditAccountId (via Service layer). Enforces accounting idempotency via `@@unique([payoutId, purpose])`.
8. **`AuditLog`**: Refactored to use `actorId` (nullable) and `actorType` (ADMIN, MERCHANT, SYSTEM).
9. **`Blacklist` & `SupportTicket`**: Change `onDelete` from Cascade to Restrict to preserve compliance and support history.

## 3. Better Auth Compatibility
- Evaluated against standard Better Auth 1.6.25: The `User`, `Session`, `Account`, and `Verification` structures remain perfectly intact.

## 4. Migration Strategy
- **Datasource:** PostgreSQL.
- **Tooling:** We formally adopt **Prisma Migrations** (`npx prisma migrate dev`). `prisma db push` is banned as a long-term mechanism.
- **Destructive Nature:** Creating this initial migration will drop incompatible legacy data in the PostgreSQL `dev` environment. We will execute `npx prisma migrate dev --name init_target_architecture` which will prompt for data loss acceptance.\n