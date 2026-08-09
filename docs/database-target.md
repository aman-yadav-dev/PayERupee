# Target Database Design (Domain Model)

This document outlines the final target Prisma schema that must be implemented in Phase 1. 

## 1. Authentication (Better Auth 1.6.25 Compatible)
- `User`: Purely manages identity (`email`, `emailVerified`). Fully compatible with standard Better Auth 1.6.25.
- `Session`, `Account`, `Verification`: Standard Better Auth tables.

## 2. Business Domain
- `MerchantProfile`: (1:1 with `User`). Holds `businessName`, `address`, `phone`, `accountStatus` (PENDING, ACTIVE, SUSPENDED).
  - **Phone Normalization:** The `phone` field is globally unique and must be stored in strict E.164 format.
- `KycApplication`: (1:1 with `MerchantProfile`). Holds document references and `status` (PENDING_SUBMISSION, UNDER_REVIEW, APPROVED, REJECTED). 
  - **Decision:** For the current architecture, 1:1 cardinality is strictly preserved. If a KYC is rejected, the existing application record is updated and resubmitted by the merchant, rather than generating a second discrete row.

## 3. Double-Entry Accounting (The Ledger Model)
- `Wallet`: Materialized view caching the merchant's balance for the UI. Uses `version` for optimistic locking.
  - **Ledger Connection:** Explicitly maps to a specific `LedgerAccount` via `ledgerAccountId` to ensure deterministic accounting.
- `LedgerAccount`: Represents financial accounts.
  - **Cardinality:** A merchant has exactly one `MERCHANT_LIABILITY` account. System accounts (`SYSTEM_TRANSIT`, `SYSTEM_REVENUE`) are global and not tied to a merchant.
  - **Currency:** Currently INR-only, but designed to be currency-aware for future expansion.
- `LedgerEntry`: Immutable financial record representing a balanced transfer between exactly one debit account and one credit account.

## 4. Transactions & Payouts
- `Payout`: Disbursal records. 
  - **Idempotency:** Enforced via a unique compound index: `@@unique([merchantProfileId, idempotencyKey])`.
  - **Accounting Definitions:**
    - `amount`: The principal amount the beneficiary receives.
    - `fee`: The service charge levied by PayERupee.
    - `tax`: The GST applied to the fee.
    - `netAmount`: `amount + fee + tax`. This is the exact total debited from the merchant wallet.
- `AuditLog`: Tracks all critical operational mutations. 
  - **Actor:** Evaluates `actorId` (nullable, allowing SYSTEM actions) and `actorType` (ADMIN, MERCHANT, SYSTEM) rather than strictly an `adminId`.

## 5. Financial Invariants
The following rules are absolute and must be enforced at the data access boundary (via Prisma and database-level `CHECK` constraints in subsequent migrations):
1. **Decimal Only:** All monetary values must use `Decimal` (`db.Decimal(18, 4)`). No `Float` allowed.
2. **Immutability:** `LedgerEntry` records are strictly immutable. No updates. No deletes.
3. **Reversals:** Corrections happen exclusively through offsetting reversal entries.
4. **Strict Positivity:** `LedgerEntry.amount` must be strictly > 0.
5. **No Self-Dealing:** `debitAccountId` must not equal `creditAccountId`.
6. **Cache vs Source of Truth:** `Wallet.balance` is a materialized/cache value. `LedgerEntry` history is the ultimate financial source of truth.
7. **Atomicity:** `Wallet` mutation and `LedgerEntry` mutation must occur atomically in a single database transaction.
8. **Zero-Sum:** Every financial transaction (`LedgerEntry`) must strictly balance (debits = credits).
9. **Idempotency:** Payout idempotency is rigidly enforced via `merchantProfileId + idempotencyKey`.
10. **Concurrency:** Concurrent financial mutations must be transactionally safe (optimistic locking on Wallet).
11. **No Hard Deletes:** Financial and compliance records (`LedgerEntry`, `Payout`, `Wallet`, `Blacklist`, `SupportTicket`) enforce `onDelete: Restrict`.\n