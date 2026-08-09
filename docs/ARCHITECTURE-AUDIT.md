# Comprehensive Architecture Audit

## 1. Current Implementation
- Next.js 15 App Router scaffolding.
- Basic Better Auth integration.
- UI elements for Login, Register, Forgot Password.
- "Fat Actions" exist where UI Server Actions execute direct Prisma transactions (e.g., `register.ts`).
- `User` model mixes Better Auth identity with Merchant business fields.

## 2. Target Architecture
- 4-Layer Service-Oriented Architecture (UI $\rightarrow$ Controller $\rightarrow$ Service $\rightarrow$ Prisma).
- Separation of `User` (Auth) and `MerchantProfile` (Domain).
- Strict double-entry accounting ledger.

## 3. Every Identified Gap & Inconsistency
- **Fat Actions:** `register.ts` and `onboarding.ts` execute `db.$transaction` directly. Must move to `src/services/`.
- **Model Mixing:** `User` table contains `businessName` and `status`. Must be separated to `MerchantProfile`.
- **Single-Entry Ledger:** `WalletTransaction` is not a true double-entry ledger. Must introduce `LedgerAccount` and `LedgerEntry`.
- **Middleware Security Misconception:** Relying on middleware for role verification instead of strict Service-level checks.
- **API Inconsistency Fixed:** `error` vs `errors` in `ApiResponse` is correctly modeled in `src/types/api.ts` as mutually exclusive fields (one string, one object), ensuring deterministic UI rendering.

## 4. Implementation Order (Post-Audit)
1. Re-model Prisma Schema (separate User/MerchantProfile, build Ledger mechanics).
2. Establish `src/services/` layer.
3. Refactor Auth Actions to use Services.

## 5. Blockers Before Phase 1
None. The architecture is now documented and finalized as the absolute source of truth.

## 6. Files That Must Eventually Be Refactored
- `src/actions/auth/register.ts`
- `src/actions/auth/onboarding.ts`
- `src/actions/auth/login.ts`
- `src/actions/auth/forgot-password.ts`
- `prisma/schema.prisma`\n