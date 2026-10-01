# Phase 3 PayMyQR Provider Boundary Audit
**Date:** 2026-08-23

## A. Provider Architecture
The application defines an `IPayoutProvider` interface. Currently, there is no PayMyQR implementation in the codebase.

## B. Provider Interface
`IPayoutProvider` expects implementations for `dispatch`, `status`, `verifyWebhookSignature`, and `parseWebhook`.

## C. PayMyQR Behavior (Source-Backed via Documentation)
1. **Authentication:** **[FACT]** Requires a `vendor` query string and/or a `security_token`.
2. **Transfer endpoint:** **[FACT]** `POST /transactions/batch?vendor=xyz`.
3. **UPI transfer parameters:** **[FACT]** Requires `transfer_mode="upi"`, `upi`, `amount`, `click_id`, `goal_id`.
4. **IMPS transfer parameters:** **[FACT]** Requires `transfer_mode="imps"`, `bank_account`, `bank_ifsc`, `beneficiary_name`, `amount`, `click_id`, `goal_id`.
5. **click_id:** **[FACT]** Described as "Unique identifier for tracking".
6. **transaction_id:** **[FACT]** Required for status lookup if `click_id` is omitted. However, creation response only returns `batch_transfer_id`. Relation is **[UNKNOWN]**.
7. **batch_transfer_id:** **[FACT]** Returned on successful creation.
8. **RECEIVED:** **[FACT]** The initial status upon transfer creation.
9. **Status Lifecycle:** **[FACT]** Documented statuses: `pending`, `processing`, `completed`, `failed`, `cancelled`.
10. **can_retry:** **[FACT]** A boolean returned in the status response. Exactly how retry should be executed is **[UNKNOWN]**.
11. **Status polling:** **[FACT]** Supports polling via `POST /transaction/status` with `transaction_id` or `click_id`.
12. **400 Bad Request:** **[FACT]** Invalid parameters.
13. **401 Unauthorized:** **[FACT]** Invalid security token.
14. **403 Forbidden:** **[FACT]** IP not whitelisted.
15. **404 Not Found:** **[FACT]** Transaction not found. Is it definitive? **[UNKNOWN / NOT PROVEN]**.
16. **500 Server Error:** **[FACT]** Internal server error. Is it safe to retry? **[UNKNOWN / NOT PROVEN]**.
17. **Timeouts / Network Failures:** **[UNKNOWN / NOT PROVEN]**.
18. **Duplicate requests:** **[UNKNOWN / NOT PROVEN]**.
19. **Duplicate click_id:** **[UNKNOWN / NOT PROVEN]**.
20. **Retry behavior:** **[UNKNOWN / NOT PROVEN]**.
21. **Idempotency:** **[UNKNOWN / NOT PROVEN]**. Do not assume `click_id` prevents duplicates.
22. **Webhooks:** **[UNKNOWN / NOT PROVEN]**. No documentation mentions webhooks.
23. **Webhook authentication / replay / ordering:** **[UNKNOWN / NOT PROVEN]**.
24. **Reconciliation:** **[FACT]** Polling is possible.
25. **Eventual consistency:** **[UNKNOWN / NOT PROVEN]**.
26. **Transaction finality:** **[ASSUMPTION]** `completed`, `failed`, `cancelled` are terminal.

## D. Identifier Mapping Audit
- `payout.id` -> `click_id`: **[ASSUMED]** Logical mapping for implementation.
- `idempotencyKey` -> `click_id`: **[UNKNOWN]**
- `batch_transfer_id` -> `transaction_id`: **[UNKNOWN]** (Requires empirical testing during implementation).

## E. Financial Failure Matrix (PayMyQR)
| Scenario | Current App Behavior | PayMyQR Doc Behavior | Financial Risk | Retry Safe? | Reconciler Fix? | Outcome |
|----------|----------------------|----------------------|----------------|-------------|-----------------|---------|
| 1. Process crashes before dispatch | Remains EXHAUSTED. Reconciler gets NOT_FOUND. Stays PROCESSING forever. | None | UX Lock | N/A | No | UNKNOWN |
| 2. Request never leaves | Same as 1. | None | UX Lock | N/A | No | UNKNOWN |
| 3. Leaves but never reaches | Same as 1. | None | UX Lock | N/A | No | UNKNOWN |
| 4. Reaches, response lost | EXHAUSTED. Reconciler polls and resolves. | Executes | None | **[UNSAFE]** | Yes | Safe |
| 5. PayMyQR returns RECEIVED | Marks PROCESSING. | Processes | None | N/A | Yes | Safe |
| 6, 7. Reports pending/processing | Stays PROCESSING. | In progress | None | N/A | Yes | Safe |
| 8, 9, 10. Reports completed/failed/cancelled | Transitions to SUCCESS/FAILED. | Terminal | None | N/A | Yes | Safe |
| 11. HTTP timeout | Same as 4. | Executes | High if retried | **[UNSAFE]** | Yes | Safe (AT-MOST-ONCE) |
| 12. HTTP 500 | Same as 4. | Unknown | High if retried | **[UNSAFE]** | Yes | Safe (AT-MOST-ONCE) |
| 13, 14, 15. HTTP 4xx | Fails/Errors inline. | Rejects | None | N/A | N/A | Safe |
| 16. Status lookup 404 | Stays PROCESSING (Ambiguous). | Not Found | UX Lock | **[UNSAFE]** | No | UNKNOWN |
| 17. Crashes during request | Same as 4. | Unknown | High if retried | **[UNSAFE]** | Yes | Safe (AT-MOST-ONCE) |
| 18. Crashes after acceptance | Locked until expiry, then Reconciler polls. | Processes | None | **[UNSAFE]** | Yes | Safe |
| 19. Duplicate dispatch | App natively blocks via `attempts`. | **[UNKNOWN]** | None | **[UNSAFE]** | N/A | Safe |
| 20. Concurrent dispatch | App natively blocks via `lockedUntil`. | **[UNKNOWN]** | None | N/A | N/A | Safe |
| 21. Reconciler race | App blocks via OCC. | Polled | None | N/A | N/A | Safe |
| 22, 23. Webhooks | App blocks via OCC. | **[NOT PROVEN]** | None | N/A | N/A | Safe |
| 24. Status changes later | Reconciler resolves on next poll. | Status updates | None | N/A | Yes | Safe |
| 25. Retry after ambiguous | **App NEVER retries.** | **[UNKNOWN]** | **Extreme** | **[UNSAFE]** | N/A | Safe |

## F. Dispatch Guarantee
1. **Application-level dispatch:** **[AT-MOST-ONCE]**
2. **Network request delivery:** **[AT-MOST-ONCE]**
3. **PayMyQR transaction creation:** **[UNKNOWN]**
4. **PayMyQR transaction execution:** **[UNKNOWN]**
5. **Retry behavior:** **[UNKNOWN]**
6. **Reconciliation behavior:** **[AT-LEAST-ONCE]** polling.

## G. Critical Architectural Question
Because PayMyQR's idempotency via `click_id` is absolutely **UNKNOWN / NOT PROVEN**, the current PayERupee architecture (which strictly forbids retrying dispatch and relies entirely on Reconciler polling to resolve timeouts) is **mandatory for financial safety**.

Changing the Outbox to retry on timeouts would be **financially catastrophic** until PayMyQR idempotency is empirically proven.

## H. Architecture Gaps
If PayMyQR does not support webhooks, Reconciler polling is the *only* way for transactions to reach finality after they enter the `RECEIVED` or `pending` state. A 15-minute polling interval is insufficient for real-time payments, necessitating a fast-polling architectural addition in a subsequent phase.

## I. Recommended Next Phase
**Phase 4 — PayMyQR Adapter Implementation & Architecture Realignment.**
We must write the adapter, empirically test idempotency and error mappings via a sandbox (or mock), and redesign the orchestrator lifecycle to accommodate the potential absence of webhooks (e.g., synchronous polling).
