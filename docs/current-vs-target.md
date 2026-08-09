# Current Implementation Gap Report

After a deep audit of the PayERupee repository, the following architectural violations and discrepancies have been identified against the Target Architecture.

## 1. Fat Actions (Architectural Risk: CRITICAL)
**Current Behavior:** 
Files like `src/actions/auth/register.ts`, `src/actions/auth/onboarding.ts`, and `src/actions/auth/forgot-password.ts` directly execute Prisma queries (e.g., `db.$transaction([db.user.update, db.wallet.create])`).
**Expected Behavior:** 
Server Actions should only parse input via Zod and call a Service (e.g., `AuthService.registerMerchant()`).
**Why it is wrong:** 
Tightly couples the Next.js API layer to the database. If an Admin needs to create a merchant later, the database logic must be duplicated, leading to bugs.
**Recommended Fix:** 
Extract all database logic from `src/actions/*` into a new `src/services/` directory.

## 2. Prisma Schema: Auth vs Domain Mixing (Architectural Risk: HIGH)
**Current Behavior:**
The `User` model in `schema.prisma` contains both Better Auth required fields (`email`, `emailVerified`) AND PayERupee domain fields (`businessName`, `status`, `role`, `kycApprovedAt`).
**Expected Behavior:**
Authentication identity should be separate from Domain identity. 
**Why it is wrong:**
Violates Single Responsibility Principle. Authentication should not care about "KYC status".
**Recommended Fix:**
Create a `MerchantProfile` model that relates to `User` 1:1, moving all business fields (`businessName`, `kycApprovedAt`, etc.) out of the base `User` table.

## 3. Incomplete Double-Entry Ledger (Architectural Risk: CRITICAL)
**Current Behavior:**
The `WalletTransaction` model acts as a single-entry ledger (it only references one `walletId`).
**Expected Behavior:**
A true double-entry ledger requires every transaction to have a DEBIT account and a CREDIT account to ensure the system balances to zero.
**Why it is wrong:**
If funds are deducted from a merchant, it is currently impossible to mathematically prove where they went (e.g., to a system fee account vs a payout transit account) without relying on application-level interpretation of the `category` enum.
**Recommended Fix:**
Implement a standard double-entry `LedgerEntry` model referencing a `creditAccountId` and `debitAccountId`.\n