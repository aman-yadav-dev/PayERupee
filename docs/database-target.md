# Target Database Design (Domain Model)

This document outlines the final target Prisma schema.

## 1. Authentication (Better Auth 1.6.25 Compatible)
- `User`: Identity only. Fully compatible with Better Auth 1.6.25.
- `Session`, `Account`, `Verification`: Standard Better Auth tables.

## 2. Business Domain
- `MerchantProfile`: (1:1 with `User`).
  - **Phone Normalization & Uniqueness:** `phone` is nullable initially. When provided during onboarding, it MUST be strictly formatted as E.164. Prisma's `@unique` on a nullable field correctly enforces uniqueness only among non-null values.
- `KycApplication`: (1:1 with `MerchantProfile`).
  - **Rejection/History Strategy:** The 1:1 relationship is strictly maintained. When a KYC is rejected, the existing row's `status` is updated to `REJECTED`. Historical review attempts, rejection reasons, and lifecycle events are durably preserved in the `AuditLog` table to satisfy compliance requirements without bloating the operational KYC table.

## 3. Double-Entry Accounting
- `LedgerAccount`:
  - **Cardinality & PostgreSQL NULL Behavior:** A merchant has exactly one `MERCHANT_LIABILITY` account per currency (enforced by `@@unique([merchantProfileId, type, currency])`). Because PostgreSQL treats `NULL != NULL` in unique indexes, multiple system accounts (`merchantProfileId = NULL`) will not trigger a unique constraint violation. System accounts will be strictly provisioned via a one-time idempotent seed script at startup to prevent duplicates.
- `Wallet`:
  - **Deterministic Mapping:** Explicitly maps to a specific `MERCHANT_LIABILITY` `LedgerAccount` via `ledgerAccountId`. The wallet's currency must perfectly match its mapped LedgerAccount's currency.
- `LedgerEntry`:
  - **Absolute Immutability:** `INSERT` operations are strictly allowed. `UPDATE` and `DELETE` operations are unconditionally forbidden. Any corrections must be executed by appending new, compensatory reversal entries.
  - **Invariants:** `amount > 0` and `debitAccountId != creditAccountId`. (Enforced by Service layer and future raw SQL `CHECK` constraints).
  - **Idempotency:** A unique constraint `@@unique([payoutId, purpose])` guarantees that network retries cannot create duplicate accounting movements for the same payout event.

## 4. Transactions & Payouts
- `Payout`:
  - **Accounting Definitions:**
    - `amount`: Beneficiary principal (amount sent to the bank).
    - `fee`: Platform fee levied by PayERupee.
    - `tax`: Tax (GST) applied to the fee.
    - `totalDebitAmount`: `amount + fee + tax`. This is the exact total debited from the merchant wallet. (Renamed from `netAmount` for clarity).
- `AuditLog`: Tracks all critical mutations (admin, merchant, or system actor).

## 5. Concrete LedgerEntry Examples
*Example: A 100 INR payout with a 2 INR fee + 0.36 INR tax.*

**Scenario A: Successful Payout Initiation**
- Entry 1 (purpose: PRINCIPAL): 
  - Debit: MERCHANT_LIABILITY (100)
  - Credit: SYSTEM_TRANSIT (100)
- Entry 2 (purpose: FEE_AND_TAX):
  - Debit: MERCHANT_LIABILITY (2.36)
  - Credit: SYSTEM_REVENUE (2.36)
  - *(Wallet balance is deducted by exactly 102.36 atomically)*

**Scenario B: Payout Fails (e.g., Invalid Bank Account)**
- Entry 3 (purpose: REVERSAL_PRINCIPAL):
  - Debit: SYSTEM_TRANSIT (100)
  - Credit: MERCHANT_LIABILITY (100)
- Entry 4 (purpose: REVERSAL_FEE_AND_TAX):
  - Debit: SYSTEM_REVENUE (2.36)
  - Credit: MERCHANT_LIABILITY (2.36)
  - *(Wallet balance is credited by 102.36 atomically)*\n