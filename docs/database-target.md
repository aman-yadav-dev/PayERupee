# Target Database Design (Domain Model)

This document outlines the final target Prisma schema that must be implemented in Phase 1. 
*(Note: Application code currently uses a legacy single-entry schema which will be replaced).*

## 1. Authentication (Better Auth)
- `User`: Purely manages identity, `email`, `emailVerified`. Managed by Better Auth.
- `Session`, `Account`: Standard Better Auth tables.

## 2. Business Domain
- `MerchantProfile`: (1:1 with `User`). Holds `businessName`, `address`, `phone`, `accountStatus` (PENDING, ACTIVE, SUSPENDED).
- `KycApplication`: (1:1 with `MerchantProfile`). Holds document references and `status` (PENDING_SUBMISSION, UNDER_REVIEW, APPROVED, REJECTED).

## 3. Double-Entry Accounting
- `Wallet`: Materialized view caching the merchant's balance for the UI. Uses `version` for optimistic locking.
- `LedgerAccount`: Abstract accounts representing System Transit, Fee Revenue, and Merchant Liability accounts.
- `LedgerEntry`: Immutable. Contains `creditAccountId`, `debitAccountId`, `amount` (Decimal 18,4), `referenceType`, and `referenceId`.

## 4. Transactions
- `Payout`: Disbursal records. Enforces uniqueness on `[merchantProfileId, idempotencyKey]`.
- `AuditLog`: Tracks all critical mutations (Admin approvals, suspensions).\n