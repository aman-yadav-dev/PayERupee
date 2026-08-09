# Phase 1: Database Migration Plan

## 1. Schema Overview
**Target Schema State:** Decoupled `MerchantProfile`, true double-entry `LedgerAccount` / `LedgerEntry`.

## 2. Invariant Enforcement
The migration enforces the strict financial invariants defined in `docs/database-target.md`. All data access will conform to the rule that `Wallet.balance` is purely a cache, and `totalDebitAmount` is strictly server-calculated.

## 3. Migration Strategy
- **Datasource:** PostgreSQL.
- **Tooling:** **Prisma Migrations** (`npx prisma migrate dev`). `prisma db push` is banned as a long-term mechanism.
- **Action:** A fresh PostgreSQL development database reset will occur. Executing `npx prisma migrate dev --name init_target_architecture` will prompt for data loss. Prisma will drop the `public` schema in the development PostgreSQL database and recreate it with the new decoupled target architecture, cleanly wiping the legacy monolithic `User` and `WalletTransaction` records.\n