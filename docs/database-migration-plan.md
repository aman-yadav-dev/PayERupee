# Phase 1: Database Migration Plan

## 1. Schema Overview
**Target Schema State:** Decoupled `MerchantProfile`, true double-entry `LedgerAccount` / `LedgerEntry`.

## 2. Invariant Enforcement
The migration enforces the strict financial invariants defined in `docs/database-target.md`. All data access will conform to the rule that `Wallet.balance` is purely a cache, and `totalDebitAmount` is strictly server-calculated.

## 3. Migration Strategy
- **Datasource:** PostgreSQL.
- **Tooling:** **Prisma Migrations** (`npx prisma migrate dev`). `prisma db push` is banned as a long-term mechanism.
- **Action:** A fresh development database reset will occur upon executing Phase 1 due to the monolithic structure of the legacy `User` table and `WalletTransaction`.\n