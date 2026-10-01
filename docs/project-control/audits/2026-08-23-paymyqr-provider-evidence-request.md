# PayMyQR Provider Evidence Request
**Date:** 2026-08-23

This document lists the exact questions that must be answered by official PayMyQR support or documentation before production integration can be designed.

## 1. Idempotency & Safe Retries
1. Is `click_id` an idempotency key?
2. If the exact same `click_id` is submitted twice, exactly what happens?
3. Can the same `click_id` ever result in two financial transfers?
4. Does PayMyQR return the original transaction/result for duplicate requests?
5. Is `click_id` globally unique?
6. What exactly does `can_retry` mean?
7. Is retry safe after HTTP 500?
8. Is retry safe after an HTTP timeout?
9. Is retry safe after a connection reset?
10. Is retry safe after an unknown response?

## 2. Identifiers & Mapping
11. What is `transaction_id`?
12. What is `batch_transfer_id`?
13. How are they related?
14. After batch creation, how do we obtain `transaction_id`?
15. Can status always be queried using `click_id` instead of `transaction_id`?

## 3. Status Semantics & Finality
16. What exactly does `RECEIVED` mean?
17. Which statuses are permanently terminal?
18. Can `completed` ever transition to `failed/reversed/cancelled`?
19. Can `failed/cancelled` ever transition back to `processing/completed`?
20. What does HTTP 404 from the status API mean?
21. Is status lookup strongly consistent?
22. Can a newly-created transaction temporarily return 404 before becoming available?
23. Is there an official reconciliation procedure for ambiguous transactions?

## 4. Webhooks & Real-time Events
24. Does PayMyQR provide webhooks?
25. If yes, please provide documentation on:
    - Webhook event types
    - Authentication and signature verification
    - Replay protection mechanisms
    - Event IDs
    - Duplicate delivery behavior (AT-LEAST-ONCE semantics)
    - Ordering guarantees
    - Retry delivery mechanics
    - Terminal event semantics

## 5. Sandbox & Testing
26. Is there a sandbox environment?
27. What are the sandbox endpoints?
28. Are sandbox credentials available?
29. Can duplicate `click_id` behavior be safely tested in the sandbox?
30. Can timeout/network failure scenarios be simulated?

## 6. Required Configuration (Names Only)
Before runtime connectivity can be established, the following environment variables must be populated (NO SECRETS RECORDED HERE):
- `PAYMYQR_BASE_URL` (Required, Environment: Sandbox/Prod)
- `PAYMYQR_VENDOR_ID` (Required, Environment: Sandbox/Prod)
- `PAYMYQR_SECURITY_TOKEN` (Required, Environment: Sandbox/Prod)

## Evidence Classification Rules
For every answer received to the above questions, it MUST be classified as one of the following:
- **FACT — official PayMyQR documentation**
- **FACT — written PayMyQR support response**
- **TEST-VERIFIED — safe sandbox experiment**
- **INFERENCE**
- **ASSUMPTION**
- **UNKNOWN**
- **NOT PROVEN**
- **EXTERNAL DEPENDENCY**

## Architectural Decision Gate
The final retry architecture CANNOT be selected until this evidence is acquired. The decision will compare:
**A. Provider-supported idempotent retry** (Highest liveness/availability, easiest operations).
**B. Provider-supported reconciliation/retry mechanism** (Medium liveness, relies on Reconciler 404 confirmation).
**C. No safe retry mechanism** (Strict AT-MOST-ONCE, extremely safe financially, but causes permanent UX locks on network drops).
**D. Provider behavior remains unknown** (Forces fallback to Option C).
