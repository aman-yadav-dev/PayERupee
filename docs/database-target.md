# Target Database Design (Domain Model)

This document outlines the final target Prisma schema and its enforced architectural constraints.

## 1. Authentication
- `User`: Identity only. Fully compatible with Better Auth 1.6.25.

## 2. Business Domain
- `MerchantProfile`: (1:1 with `User`).
  - **Phone Normalization & Uniqueness:** `phone` is nullable initially. When provided, it MUST be strictly formatted as E.164. Unique among non-null values.
- `KycApplication`: (1:1 with `MerchantProfile`).
  - **State Strategy:** `KycApplication` represents the *current/latest* KYC state. Rejected applications do not create new rows. Historical state transitions (reviews, rejections, approvals) are durably preserved in the `AuditLog` table.

## 3. Double-Entry Accounting
- `LedgerAccount`:
  - **Cardinality:** `@@unique([merchantProfileId, type, currency])`.
  - **System Accounts & PostgreSQL NULLs:** Because PostgreSQL treats `NULL != NULL` in unique indexes, system accounts (`merchantProfileId = NULL`) are not constrained by this index. Therefore, deterministic system accounts (e.g., `SYSTEM_TRANSIT_INR`, `SYSTEM_REVENUE_INR`) must be provisioned via a one-time idempotent seed script at startup to prevent duplicates.
- `Wallet`:
  - **Deterministic Mapping:** Explicitly maps to a specific `MERCHANT_LIABILITY` `LedgerAccount` via `ledgerAccountId`.
  - **Accounting Direction:** 
    - Credits to a merchant liability account *increase* the merchant balance.
    - Debits to a merchant liability account *decrease* the merchant balance.
  - **Reconstruction Formula:** `Wallet.balance` = `SUM(creditEntries.amount) - SUM(debitEntries.amount)` for its mapped LedgerAccount.
  - **Cache:** `Wallet.balance` is purely a materialized/cache value. `LedgerEntry` is the source of truth.
  - **Atomicity:** `Wallet` mutation and `LedgerEntry` insertion must occur atomically in one DB transaction.
- `LedgerEntry`:
  - **Absolute Immutability:** `INSERT` allowed. `UPDATE` forbidden. `DELETE` forbidden. Corrections happen through compensating/reversal entries.
  - **Idempotency:** A unique constraint `@@unique([payoutId, purpose])` guarantees that network retries cannot create duplicate accounting movements.
  - **Purposes for a Payout:** Only the following `LedgerEntryPurpose` values can exist for a single Payout: `PRINCIPAL`, `FEE_AND_TAX`, `REVERSAL_PRINCIPAL`, `REVERSAL_FEE_AND_TAX`.

## 4. Transactions & Payouts
- `Payout`:
  - **Accounting Definitions:**
    - `amount`: Beneficiary principal.
    - `fee`: Platform fee.
    - `tax`: Tax.
    - `totalDebitAmount`: `amount + fee + tax`.
  - **Security Invariant:** `totalDebitAmount` MUST be server-calculated. It must NEVER be trusted from client input.

## 5. AuditLog
- Tracks all critical mutations.
- **Actor Architecture:** `actorId` is intentionally NOT a foreign key because it may reference `ADMIN`, `MERCHANT`, or `SYSTEM` actors, meaning it cannot statically reference a single table. It preserves historical events permanently.

## 6. Strict Financial Invariants
1. **Decimal Only:** `Decimal(18,4)` exclusively.
2. **No Float:** Floating-point representations are prohibited.
3. **Strict Positivity:** `amount > 0`.
4. **No Self-Dealing:** `debitAccountId != creditAccountId`.
5. **Total Debit:** `totalDebitAmount = amount + fee + tax`.
6. **LedgerEntry Immutability:** No updates, no deletes. Reversals use compensating entries.
7. **Idempotency:** Enforced at both application level (idempotency keys) and database level (`@@unique([payoutId, purpose])`).
8. **Atomicity:** Wallet + ledger changes are atomic.\n