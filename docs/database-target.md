# Target Database Design (Domain Model)

This document outlines the final target Prisma schema that must be implemented in Phase 1. 

## 1. Authentication (Better Auth)
- `User`: Purely manages identity (`email`, `emailVerified`). Managed by Better Auth.
- `Session`, `Account`: Standard Better Auth tables.

## 2. Business Domain
- `MerchantProfile`: (1:1 with `User`). Holds `businessName`, `address`, `phone`, `accountStatus` (PENDING, ACTIVE, SUSPENDED).
- `KycApplication`: (1:1 with `MerchantProfile`). Holds document references and `status` (PENDING_SUBMISSION, UNDER_REVIEW, APPROVED, REJECTED). 
  - **Decision:** For the current architecture, 1:1 cardinality is strictly preserved. If a KYC is rejected, the existing application record is updated and resubmitted by the merchant, rather than generating a second discrete row.

## 3. Double-Entry Accounting (The Ledger Model)
- `Wallet`: Materialized view caching the merchant's balance for the UI. Uses `version` for optimistic locking.
- `LedgerAccount`: Abstract accounts representing System Transit, Fee Revenue, and Merchant Liability accounts.
- `LedgerEntry`: Immutable financial record.
  - **Accounting Postings:** Each `LedgerEntry` represents a balanced transfer between exactly one debit account and one credit account (`debitAccountId`, `creditAccountId`, `amount`). It ensures strict double-entry balancing per record.

## 4. Transactions
- `Payout`: Disbursal records. 
  - **Idempotency:** Enforced via a unique compound index on the Payout itself: `@@unique([merchantProfileId, idempotencyKey])`. There is no separate IdempotencyKey table.
  - **Ledger Relationship:** A single Payout can generate one-to-many (`1..N`) `LedgerEntry` records. This is an intentional decision to support fees: Entry 1 transfers the principal, and Entry 2 transfers the payout fee.
- `AuditLog`: Tracks all critical operational mutations. 
  - **Minimum Conceptual Information:** Records `actor` (who did it), `action` (what happened), `entity type` (e.g., MerchantProfile), `entity ID` (the affected record ID), `metadata` (JSON snapshot), and `timestamp`.

## 5. Financial Invariants
The following rules are absolute and must be enforced at the data access boundary:
- **Decimal Only:** All monetary values must use `Decimal` (`db.Decimal(18, 4)`).
- **No Float:** Floating-point representations (`Float`) are strictly prohibited.
- **Immutability:** `LedgerEntry` records are strictly immutable.
- **Cache vs Source of Truth:** `Wallet.balance` is a materialized/cache value for UI speed, not the accounting source of truth.
- **Source of Truth:** The `LedgerEntry` history is the ultimate financial source of truth.
- **Atomicity:** `Wallet` mutation and `LedgerEntry` mutation must occur atomically in a single database transaction.
- **Zero-Sum:** Every financial transaction (`LedgerEntry`) must balance (debits = credits).
- **Idempotency:** Payout idempotency is rigidly enforced by the database via `merchantProfileId + idempotencyKey`.
- **Concurrency:** Concurrent financial mutations must be transactionally safe (utilizing optimistic locking on Wallet).
- **No Hard Deletes:** Financial records (`LedgerEntry`, `Payout`, `Wallet`) must not be hard-deleted.\n