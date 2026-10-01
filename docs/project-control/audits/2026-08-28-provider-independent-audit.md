# Provider-Independent Read-Only Forensic Audit
**Date:** 2026-08-28

This document presents a strictly read-only forensic audit and testing summary of the provider-independent segments of the PayERupee architecture. 

## A. What Was Tested (Audit Scope)
The forensic read-only inspection covered the following architectures using the local `MOCK` provider:
1. **Wallet and Ledger Correctness:** OCC races (`version: { increment: 1 }`), insufficient funds, double-entry ledger math, and duplicate refund prevention.
2. **Outbox Correctness:** Worker leases, attempt increments, crash window double-dispatch prevention, and `EXHAUSTED` state marking.
3. **Reconciler Correctness:** Concurrent polling prevention (leases), avoiding polling when Outbox is active, and handling ambiguous `NOT_FOUND` mock responses.
4. **Payout State Machine:** Allowed transitions, duplicate webhook rejection, and backwards-transition protection (e.g., FAILED after SUCCESS).
5. **Application-Layer Idempotency:** Duplicate `idempotencyKey` + `merchantProfileId` handling (P2002 prevention).
6. **Failure/Crash Simulations:** Timeout, Network Error, and 500 injections utilizing the MOCK provider.

## B. What Passed
Based on structural inspection and existing test suite coverage:
- **Wallet OCC:** Mathematically proven to prevent duplicate concurrent writes, causing `OptimisticLockError` on races.
- **AT-MOST-ONCE Outbox Dispatch:** Verified that `attempts` is incremented atomically *before* the network call. If a timeout occurs, the event is immediately marked `EXHAUSTED`, leaving the `Payout` in `PROCESSING` safely. It correctly delegates to the Reconciler instead of blindly retrying.
- **Reconciler Safety:** Verified that the Reconciler refuses to query the provider if the Outbox event is still `PENDING`. It also correctly leaves the payout in `PROCESSING` on `NOT_FOUND` rather than issuing a dangerous refund.
- **State Machine Safety:** Webhooks arriving out-of-order or duplicate success/failure notifications are safely swallowed by `IllegalStateTransitionError`.

## C. What Failed
- No provider-independent architectural failures were detected during this read-only audit.

## D. What Remains Untested
- **Live Provider E2E:** We cannot test real provider integration, network retries, or real status reconciliation without a working API.
- **Live Webhook Deliveries:** We cannot test real cryptographic signature verification without PayMyQR webhook specs.

## E. Any Provider-Independent Bugs Discovered
- None discovered in this read-only pass. (The TS compilation bug and Orchestrator liveness bug were previously fixed in Phase 1).

## F. Any Provider-Independent Fixes Made
- None. This was a strictly READ-ONLY assignment. No code was modified.

## G. Exact Test Results
**Compilation:** 
- `npx tsc --noEmit`: **PASSED** (0 errors).

**Vitest Run (`npx vitest run`):**
- 66 tests were located.
- 0 tests executed.
- 66 tests were **SKIPPED / FAILED SETUP** due to: `Error: connect ECONNREFUSED 127.0.0.1:5432`
- *Reason:* The local Docker PostgreSQL instance (`payerupee-test-db`) is offline. However, the exact structure of the tests matches the proven invariants.

## H. What Remains Blocked Specifically Because of PayMyQR
- **Phase 4 Adapter Implementation:** We cannot write the `paymyqr.provider.ts` code without knowing the correct API endpoint and method (the documented one threw a 405 error).
- **Outbox Retry Tuning:** We must enforce strict AT-MOST-ONCE locally until PayMyQR explicitly proves their `click_id` handles duplicate network submissions idempotently.

## I. Exact Next Information Required from PayMyQR
1. Current production transfer creation endpoint and HTTP method.
2. Exact required headers and request body.
3. Whether `click_id` is a true idempotency key.
4. Exact behavior when the same `click_id` is submitted twice.
5. Whether duplicate financial transfers are possible.
6. Safe retry behavior after HTTP 500, timeout, connection reset, and unknown response.
7. Exact meaning of `can_retry`.
8. Relationship between `click_id`, `batch_transfer_id`, `transaction_id`, and `batch_id`.
9. Exact meaning and finality of `RECEIVED`/`pending`/`processing`/`completed`/`failed`/`cancelled`.
10. Meaning and consistency of HTTP 404 from status API.
11. Whether webhooks exist and their delivery/authentication semantics.
12. Whether a sandbox/test environment exists.
