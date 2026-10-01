# Financial Domain & Architecture Baseline Audit
**Date:** 2026-08-23
**Status:** READ-ONLY INVENTORY COMPLETE

## 1. Project Architecture & Boundaries
**State:** Genuinely completed core transactional boundaries.
**Evidence:** `src/modules/payout/domain/payout.service.ts`
**Analysis:** The application separates database boundaries from network boundaries. `processPayout` strictly enforces State OCC (`status: PENDING` -> `PROCESSING`) and Ledger/Wallet compensation within a single Prisma transaction.

## 2. Dispatch Idempotency & Concurrency (The Two-Generals Problem)
**State:** AT-MOST-ONCE network dispatch safely enforced.
**Evidence:** 
- `payout.service.ts`: `OutboxEvent.attempts = 1` initialization.
- `outbox.processor.ts`: `db.outboxEvent.updateMany({ ... data: { attempts: { increment: 1 } } })`.
**Analysis:** The system leverages Postgres row-level locks (`updateMany` with `lockedUntil`) and atomic increments to guarantee a worker gets an exclusive claim. By enforcing `attempts > 0 -> EXHAUSTED` logic, the network egress is strictly AT-MOST-ONCE. 
- **Crash Window:** If the process crashes *after* the DB commit but *before* the HTTP request, the payout is safely marked `EXHAUSTED` and stuck in `PROCESSING`. This prevents double-dispatch but delays reconciliation by 24 hours (a liveness gap, not a safety gap).
**Status:** [FACT] Genuinely Safe against Double-Dispatch.

## 3. Webhook & Reconciler Safety
**State:** EXACTLY-ONCE Wallet Compensation enforced.
**Evidence:**
- `wallet.service.ts`: `adjustWalletBalance` uses Version OCC (`version: { increment: 1 }`).
- `payout.service.ts`: `failPayout` and `handlePayoutSuccess` use State OCC (`where: { status: PROCESSING }`).
**Analysis:** Concurrent webhooks, duplicate webhooks, or webhook-vs-reconciler races are neutralized. The first transaction wins; subsequent transactions throw `P2025` (OptimisticLockError or RecordNotFound).
**Status:** [FACT] Genuinely Safe against Double-Refunds.

## 4. Provider Interface & Contracts
**State:** Safely handles Ambiguity.
**Evidence:** `payout.reconciler.ts` (lines 58-64), `cashfree.provider.ts`
**Analysis:** `NOT_FOUND`, `TIMEOUT`, and `NETWORK_ERROR` do not trigger automated refunds. The Reconciler explicitly classifies these as UNKNOWN and leaves the payout in `PROCESSING`.
**Status:** [FACT] Genuinely Safe against Ambiguous Refunds.

## 5. Security & Edge Middleware
**State:** Initial Edge security exists but is untested at the provider level.
**Evidence:** Webhook signatures checked manually in `payout-webhook.controller.ts`.
**Status:** [PARTIALLY COMPLETED] Requires further API-level validation.

## 6. Known Bugs & Unsafe Implementations
1. **Compilation Error [UNSAFE]**: `handlePayoutSuccess` is invoked in `outbox.processor.ts` (line 89) but is NOT imported at the top of the file. This causes a `ReferenceError` at runtime if a provider synchronously returns `SUCCESS` to the background worker. This was missed by tests because Vitest transpiles without typechecking and tests didn't simulate this exact background synchronous-success path.
2. **Reconciliation Delay [WARNING]**: `payout.orchestrator.ts` catches network errors and sets `attempts = 1`, `nextRunAt = +24h`, but FORGETS to set `status = EXHAUSTED`. This causes the Reconciler to ignore it (since it's `PENDING`) for 24 hours until the background worker sweeps it, marks it `EXHAUSTED`, and unlocks it for the Reconciler. 
3. **Database Constraints [ASSUMPTION]**: `providerReference` in `Payout` model does NOT have a `@unique` constraint in `schema.prisma`. It was assumed this was added in previous phases, but the schema lacks it.

## 7. Test Strategy Gaps
**State:** 65/65 tests passing.
**Analysis:** The tests prove database state transitions work locally under ideal conditions. They DO NOT prove runtime type safety (hence the missing import bug). They mock the provider, meaning actual provider latency, TCP resets, and 502 Bad Gateway behaviors are not truly tested. The tests establish *logical* safety, not *operational* safety.
**Status:** [TEST-VERIFIED] Logical correctness. [UNPROVEN] Operational resilience.
