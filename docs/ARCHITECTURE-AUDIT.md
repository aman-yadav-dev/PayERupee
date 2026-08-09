# Comprehensive Architecture Audit & Freeze

## 1. Current Implementation
- Next.js 15 App Router scaffolding with Better Auth setup.
- "Fat Actions" currently bypass Services and directly invoke Prisma `$transaction`.
- `WalletTransaction` is a single-entry model failing true fintech ledger requirements.

## 2. Target Architecture
- 4-Layer Service Architecture: UI $\rightarrow$ Controller $\rightarrow$ Service $\rightarrow$ Prisma.
- True double-entry ledger (`LedgerAccount` & `LedgerEntry`).
- Explicit distinction between Identity (User) and Business Domain (MerchantProfile).

## 3. Discrepancies & Gaps (To Be Fixed in Phase 1-3)
- **Fat Actions:** Server Actions must be gutted and mapped to `src/services/`.
- **Model Mixing:** `User` table currently holds business fields.
- **Single-Entry Ledger:** `WalletTransaction` must be deprecated for `LedgerEntry`.
- **API Response:** Documentation updated to clarify the `error` and `errors` coexistence model.

## 4. Implementation Order (Roadmap)
- **Phase 0:** Architecture Freeze (Current state).
- **Phase 1:** Database/Domain foundation (Deploying Target Prisma Schema).
- **Phase 2:** Service layer foundation (Building Core Services).
- **Phase 3:** Authentication/authorization (Connecting API to Services).

## 5. Blockers Before Phase 1
- **None.** The architecture is formally frozen. Phase 1 may commence upon explicit approval.

## 6. Files That Must Eventually Be Refactored
- `prisma/schema.prisma`
- `src/actions/auth/register.ts`, `login.ts`, `forgot-password.ts`, `onboarding.ts`\n