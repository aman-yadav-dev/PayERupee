# Phase 1: Database Migration Plan

## 1. Schema Overview
**Current Schema State:** Monolithic `User` model and single-entry `WalletTransaction`.
**Target Schema State:** Decoupled `MerchantProfile`, true double-entry `LedgerAccount` / `LedgerEntry`.

## 2. Model-by-Model Mapping
1. **`User`**: Keep Better Auth fields (`id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`). Keep `role` (`ADMIN`, `MERCHANT`). Remove domain fields.
2. **`Wallet`**: Connect directly to `LedgerAccount` via `ledgerAccountId`. Keep `version` for optimistic locking.
3. **`Payout`**: Enforce `@@unique([merchantProfileId, idempotencyKey])`. 
   - `netAmount` = `amount + fee + tax` (Amount debited from wallet).
4. **`WalletTransaction`**: REMOVE.
5. **`MerchantProfile`**: NEW (1:1 with User). `phone` is E.164 and globally unique.
6. **`LedgerAccount`**: NEW. Handles Cardinality: `@@unique([merchantProfileId, type, currency])`. System accounts have `merchantProfileId = null`.
7. **`LedgerEntry`**: NEW. Immutable. Enforces amount > 0 and debitAccountId != creditAccountId (via DB constraints).
8. **`AuditLog`**: Refactored to use `actorId` and `actorType` instead of strict `adminId`.
9. **`Blacklist` & `SupportTicket`**: Change `onDelete` from Cascade to Restrict for compliance.

## 3. Better Auth Compatibility
- Evaluated against standard Better Auth 1.6.25: The `User`, `Session`, `Account`, and `Verification` structures remain perfectly intact.

## 4. Migration Strategy
- **Datasource:** PostgreSQL. (References to local SQLite `dev.db` have been discarded).
- **Tooling:** We formally adopt **Prisma Migrations** (`npx prisma migrate dev`). `prisma db push` is banned as a long-term mechanism.
- **Destructive Nature:** Because the current PostgreSQL schema contains monolithic `User` fields and legacy `WalletTransaction` records, creating this initial migration will drop incompatible data. We will execute `npx prisma migrate dev --name init_target_architecture` which will prompt for data loss acceptance on the development database.\n