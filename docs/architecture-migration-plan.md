# PayERupee: Phase 5.5 Architecture Migration Plan

## OVERVIEW
This plan outlines the structural migration of PayERupee toward a Domain/Module-first architecture. 

**CRITICAL INVARIANT:** No financial logic (`wallet.service.ts`, `ledger.service.ts`, payout transitions) will be semantically modified. Prisma `$transaction` blocks will remain exactly as they are. This is strictly a file movement and import-adjustment phase to establish explicit modular boundaries.

## REPOSITORY PATTERN DECISION
*Analysis:* The current `wallet.service.ts` and `ledger.service.ts` directly utilize `db` (Prisma) including raw `$transaction` contexts (passing `Omit<PrismaClient, ...>`). 
*Decision:* Mechanically enforcing an `IWalletRepository` at this stage requires rewriting proven, mathematically sound database transaction signatures. This introduces high risk to financial invariants. 
*Action:* We will **NOT** abstract Prisma behind Repositories in this phase for the core financial modules. The domains will move to their new folders but will continue to import `src/infrastructure/database/db.ts`. This preserves the existing Vitest integration tests and financial safety.

---

## FILE MIGRATION MAPPING

### 1. Database Infrastructure
*   **Current:** `src/lib/db.ts`
*   **Target:** `src/infrastructure/database/db.ts`
*   **Why:** Prisma client is a pure infrastructure detail.
*   **Dependencies:** None.
*   **Risk:** LOW. Requires broad import path updates.
*   **Behavior Change:** None. Protected by all integration tests.

### 2. Wallet Domain (FROZEN LOGIC)
*   **Current:** `src/lib/services/wallet.service.ts`
*   **Target:** `src/modules/wallet/domain/wallet.service.ts`
*   **Why:** Establishing the Wallet feature module.
*   **Dependencies:** `db.ts`, `decimal.ts`.
*   **Risk:** LOW.
*   **Behavior Change:** None. Protected by `wallet-concurrency.test.ts`.

### 3. Ledger Domain (FROZEN LOGIC)
*   **Current:** `src/lib/services/ledger.service.ts`
*   **Target:** `src/modules/ledger/domain/ledger.service.ts`
*   **Why:** Establishing the Ledger feature module.
*   **Dependencies:** `db.ts`.
*   **Risk:** LOW.
*   **Behavior Change:** None. Protected by `ledger.service.test.ts`.

### 4. Payout Domain (FROZEN LOGIC)
*   **Current:** `src/lib/services/payout.service.ts`
*   **Target:** `src/modules/payout/domain/payout.service.ts`
*   **Why:** Establishing the Payout feature module.
*   **Dependencies:** `wallet.service`, `ledger.service`, `db.ts`.
*   **Risk:** LOW.
*   **Behavior Change:** None. Protected by `payout.service.test.ts`.

### 5. Payout Application (Orchestrator)
*   **Current:** `src/lib/orchestrators/payout.orchestrator.ts`
*   **Target:** `src/modules/payout/application/payout.orchestrator.ts`
*   **Why:** Separating orchestrating logic (which calls external providers) from pure domain services.
*   **Dependencies:** `payout.service.ts`, `provider.interface.ts`, `db.ts`.
*   **Risk:** LOW.
*   **Behavior Change:** None.

### 6. Provider Abstraction
*   **Current:** `src/lib/providers/provider.interface.ts`, `payout-provider.interface.ts`, `mock.provider.ts`
*   **Target:** 
    *   `src/modules/provider/core/provider.interface.ts`
    *   `src/modules/provider/adapters/mock.provider.ts`
*   **Why:** Creating a clean interface for Phase 6 (Razorpay/Cashfree) injection.
*   **Dependencies:** `ProviderOutcome` typings.
*   **Risk:** LOW.
*   **Behavior Change:** None.

### 7. HTTP Controllers (Refactoring Boundary)
*   **Current:** Logic tightly coupled inside `src/app/api/v1/payouts/route.ts` and `src/app/api/webhooks/payouts/route.ts`
*   **Target:** 
    *   `src/modules/payout/controllers/payout.controller.ts`
    *   `src/modules/webhook/controllers/payout-webhook.controller.ts`
    *   `route.ts` files will remain in `app/api/...` but will merely parse `NextRequest` and immediately pass it to the Controller.
*   **Why:** Next.js Route Handlers should be pure framework boundaries. The application-facing HTTP handling (Zod parsing, Auth extraction, orchestrator dispatch) moves to Controllers.
*   **Dependencies:** Orchestrator, MockProvider, Zod, Logger.
*   **Risk:** MEDIUM. We are extracting logic from the framework handler to a separate class/function.
*   **Behavior Change:** None. The HTTP interface remains mathematically identical.
*   **Test Coverage:** Fully protected by `orchestrator.test.ts` which performs supertest-style API calls.

### 8. Authentication & Security
*   **Current:** `src/lib/api-auth.ts`, `src/lib/auth.ts`, `src/schemas/auth.ts`
*   **Target:** 
    *   `src/modules/auth/application/api-auth.service.ts`
    *   `src/modules/auth/infrastructure/better-auth.ts`
    *   `src/modules/auth/schemas/auth.schema.ts`
*   **Why:** Consolidating security boundaries.
*   **Dependencies:** `db.ts`.
*   **Risk:** LOW.

### 9. Utilities & Observability
*   **Current:** `src/lib/utils/logger.ts`, `src/lib/utils/decimal.ts`, `src/lib/utils/rate-limit.ts`
*   **Target:**
    *   `src/infrastructure/logger/logger.ts`
    *   `src/shared/utils/decimal.ts`
    *   `src/shared/utils/rate-limit.ts`
*   **Why:** `logger` is an infrastructure dependency. `decimal` is a shared domain utility.
*   **Risk:** LOW.

## CIRCULAR DEPENDENCY RISKS
No circular dependencies are introduced by this movement. Domain logic flows strictly downward into `db.ts` and utility files. Controllers call Orchestrators, which call Services.

## STOP CONDITION EVALUATION
*   Are we modifying `wallet` or `ledger` financial logic? **NO.**
*   Are we modifying `schema.prisma`? **NO.**
*   Are we modifying payout state semantics? **NO.**
*   Are we introducing Provider terminology into the core? **NO.**
*   Does this change the transaction boundaries? **NO.**

## NEXT ACTION
Upon explicit approval of this plan, I will physically execute the file migrations, implement the Controller extractions, update all imports, and run the `tsc` and `vitest` suite to guarantee strict behavioral preservation.
