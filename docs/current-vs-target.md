# Gap Analysis: Current vs Target

## The Register Action
**File:** `src/actions/auth/register.ts`
**Current State:** Fat Action. Contains Better Auth calls, raw `db.$transaction`, and wallet creation.
**Target State:** Should strictly parse inputs and delegate to `AuthService.registerMerchant()`.
**Risk Level:** HIGH (Architectural Debt)

## Missing Service Layer
**Current State:** No `src/services/` directory exists.
**Target State:** `WalletService`, `AuthService`, `KycService` must be implemented before financial features proceed.\n