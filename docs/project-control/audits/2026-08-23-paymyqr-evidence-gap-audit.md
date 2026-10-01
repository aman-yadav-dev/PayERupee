# PayMyQR Evidence Gap Audit
**Date:** 2026-08-23

## A. Provider Contract Audit & Questions
1. **Is click_id actually idempotent?** **[UNKNOWN / NOT PROVEN]** The documentation only states "Unique identifier for tracking."
2. **What happens if the exact same click_id is submitted twice?** **[UNKNOWN / NOT PROVEN]**
3. **Does PayMyQR reject the duplicate?** **[UNKNOWN / NOT PROVEN]**
4. **Does PayMyQR return the original transaction?** **[UNKNOWN / NOT PROVEN]**
5. **Does PayMyQR create two transactions?** **[UNKNOWN / NOT PROVEN]**
6. **Is click_id unique globally or only unique for tracking?** **[UNKNOWN / NOT PROVEN]**
7. **What is the exact relationship between click_id, transaction_id, batch_transfer_id, batch_id?** **[UNKNOWN / NOT PROVEN]**
8. **After POST /transactions/batch returns RECEIVED:**
   - Where do we obtain `transaction_id`? **[UNKNOWN / NOT PROVEN]** (Creation returns `batch_transfer_id`, not `transaction_id`).
   - Can status be queried using `click_id` instead? **[FACT - DOCUMENTATION]** Yes.
   - Is `click_id` guaranteed to resolve to the created transaction? **[UNKNOWN / NOT PROVEN]**
9. **What exactly does RECEIVED mean?** **[FACT - DOCUMENTATION]** "Transfer received successfully."
10. **Does RECEIVED mean request accepted, transaction created, transaction queued, or something else?** **[UNKNOWN / NOT PROVEN]**
11. **Is RECEIVED terminal?** **[INFERENCE]** No, because polling returns further statuses.
12. **Are pending, processing, completed, failed, cancelled terminal or non-terminal?** **[UNKNOWN / NOT PROVEN]**
13. **Can completed later become failed?** **[UNKNOWN / NOT PROVEN]**
14. **Can completed later become cancelled?** **[UNKNOWN / NOT PROVEN]**
15. **Can failed later become completed?** **[UNKNOWN / NOT PROVEN]**
16. **Can cancelled later become completed?** **[UNKNOWN / NOT PROVEN]**
17. **What exactly does can_retry mean?** **[UNKNOWN / NOT PROVEN]**
18. **Does can_retry mean retry the same transaction, create a new transaction, retry only after failure, or something else?** **[UNKNOWN / NOT PROVEN]**
19. **Is retry after HTTP 500 safe?** **[UNKNOWN / NOT PROVEN]**
20. **Is retry after timeout safe?** **[UNKNOWN / NOT PROVEN]**
21. **Is retry after connection reset safe?** **[UNKNOWN / NOT PROVEN]**
22. **Is retry after HTTP 404 safe?** **[UNKNOWN / NOT PROVEN]**
23. **Does PayMyQR provide webhook support?** **[UNKNOWN / NOT PROVEN]**
24. **Webhook details (auth, signature, replay, ordering, etc.):** **[N/A]**
25. **If no webhook documentation exists, explicitly mark webhook support:** **[UNKNOWN / NOT PROVEN]**
26. **What does HTTP 500 mean?** **[FACT - DOCUMENTATION]** Internal server error. **[INFERENCE]** The transaction may or may not have been created; it is ambiguous.
27. **What does HTTP 404 from status mean?** **[FACT - DOCUMENTATION]** Transaction not found. **[UNKNOWN / NOT PROVEN]** if this means it definitively never existed, or if it is merely eventual consistency lag.
28. **Is status lookup strongly consistent?** **[UNKNOWN / NOT PROVEN]**
29. **Could status lookup temporarily return 404 after transaction creation?** **[UNKNOWN / NOT PROVEN]**
30. **What is the provider's documented reconciliation mechanism?** **[FACT - DOCUMENTATION]** POST to `/transaction/status` using `transaction_id` or `click_id`.

## B. Identifier Mapping Audit
- **payout.id -> click_id**: **[ASSUMPTION]** (Logical for implementation, not yet built).
- **idempotencyKey -> click_id**: **[UNKNOWN / NOT PROVEN]**
- **batch_transfer_id -> transaction_id**: **[UNKNOWN / NOT PROVEN]**

## C. PayMyQR Credential / Environment Audit
Inspected `.env` and `src/config/env.ts`. There are NO environment variables for PayMyQR base URL, vendor identifier, security token, or environment selection.
**Conclusion:** PayMyQR runtime connectivity is NOT currently available/proven.

## D. Sandbox Status
**[UNKNOWN / NOT PROVEN]** The provided documentation and repository lack any sandbox URLs, test credentials, test modes, or methods for safely testing duplicate requests.

## E. Financial Failure Matrix
| Scenario | Current App Behavior | PayMyQR Doc Behavior | Financial Risk | Retry Safe? | Retry Unsafe? | Reconciler Can Resolve? | Refund Permitted? | Outcome |
|----------|----------------------|----------------------|----------------|-------------|---------------|-------------------------|-------------------|---------|
| 1. Crashes before dispatch | Outbox locked, then EXHAUSTED. Reconciler gets NOT_FOUND. | N/A | UX Lock | No | Yes | No (Stays PROCESSING) | No | UNKNOWN |
| 2. Never leaves PayERupee | Same as 1. | N/A | UX Lock | No | Yes | No | No | UNKNOWN |
| 3. Leaves but never reaches | Same as 1. | N/A | UX Lock | No | Yes | No | No | UNKNOWN |
| 4. Received, response lost | EXHAUSTED. Reconciler polls & resolves. | Executes | None | No | Yes | Yes | No | Safe |
| 5. Returns 200 RECEIVED | Marks PROCESSING. Reconciler finishes later. | RECEIVED | None | No | Yes | Yes | No | Safe |
| 6, 7. Reports pending/processing | Stays PROCESSING. | In progress | None | No | Yes | Yes | No | Safe |
| 8. Reports completed | Transitions SUCCESS. | Terminal? | None | No | Yes | Yes | No | Safe |
| 9, 10. Reports failed/cancelled | Transitions FAILED. | Terminal? | None | No | Yes | Yes | Yes | Safe |
| 11. HTTP timeout | EXHAUSTED. Reconciler polls. | Unknown | Extreme double-dispatch if retried | No | Yes | Yes (if found), No (if 404) | No | Safe (AT-MOST-ONCE) |
| 12. HTTP 500 | EXHAUSTED. Reconciler polls. | Unknown | Extreme double-dispatch if retried | No | Yes | Yes (if found), No (if 404) | No | Safe (AT-MOST-ONCE) |
| 13, 14, 15. HTTP 4xx | Fails/Errors inline. | Rejects | None | No | Yes | N/A | Yes | Safe |
| 16. Status lookup 404 | Stays PROCESSING (Ambiguous). | Not Found | UX Lock | No | Yes | No | No | UNKNOWN |
| 17. Crashes during request | Same as 11. | Unknown | Extreme double-dispatch if retried | No | Yes | Yes (if found), No (if 404) | No | Safe (AT-MOST-ONCE) |
| 18. Crashes after accepted | Locked, then Reconciler polls. | Processes | None | No | Yes | Yes | No | Safe |
| 19. Duplicate dispatch | App natively blocks via `attempts`. | **[UNKNOWN]** | None | No | Yes | N/A | N/A | Safe |
| 20. Concurrent dispatch | App natively blocks via `lockedUntil`. | **[UNKNOWN]** | None | No | Yes | N/A | N/A | Safe |
| 21. Reconciler race | App blocks via OCC. | Polled | None | No | Yes | N/A | N/A | Safe |
| 22. Duplicate webhook | App blocks via OCC. | **[NOT PROVEN]** | None | No | Yes | N/A | N/A | Safe |
| 23. Out-of-order webhook | App blocks via OCC. | **[NOT PROVEN]** | None | No | Yes | N/A | N/A | Safe |
| 24. Status changes later | Reconciler resolves on next poll. | Status updates | None | No | Yes | Yes | No | Safe |
| 25. Retry after ambiguous | **App NEVER retries.** | **[UNKNOWN]** | **Extreme** | No | Yes | N/A | No | Safe |

## F. Dispatch Guarantee Classification
- **Application-level dispatch:** **[AT-MOST-ONCE]**
- **Network request delivery:** **[AT-MOST-ONCE]**
- **PayMyQR transaction creation:** **[UNKNOWN]**
- **PayMyQR transaction execution:** **[UNKNOWN]**
- **Retry behavior:** **[AT-MOST-ONCE]** (App never retries).
- **Reconciliation behavior:** **[AT-LEAST-ONCE]** (Polling loop).

## G. Architectural Decision Matrix
**OPTION A: PayMyQR proves idempotent retry.**
- **Safe retry model:** Outbox automatically retries timeout/500 using `click_id`.
- **Outbox design:** EXACTLY-ONCE (powers through network drops).
- **Reconciliation design:** Polls only for terminal state, not for dropped requests.
- **Financial risk:** Low.
- **Availability / Liveness:** High (self-healing).
- **Operational burden:** Low.
- **Evidence required:** Proof that duplicate `click_id` safely returns the existing transaction and strictly rejects double-dispatch.

**OPTION B: PayMyQR provides another safe retry/reconciliation mechanism.**
- **Safe retry model:** E.g., `404` status lookup is strongly consistent, allowing safe retry.
- **Outbox design:** AT-MOST-ONCE.
- **Reconciliation design:** Polls. Re-dispatches if definitive 404.
- **Financial risk:** Low.
- **Availability / Liveness:** Medium (delayed healing via Reconciler).
- **Operational burden:** Medium.
- **Evidence required:** Proof that `404` from status API means the transfer DEFINITIVELY never existed and will never exist.

**OPTION C: PayMyQR does NOT provide idempotent retry.**
- **Safe retry model:** NONE.
- **Outbox design:** Strict AT-MOST-ONCE.
- **Reconciliation design:** Polls. MUST NOT retry on 404 or 500.
- **Financial risk:** Low to platform (no double spend), High to merchant (stranded funds).
- **Availability / Liveness:** Low (network drops cause permanent UX lock).
- **Operational burden:** Extremely High (admin intervention required).
- **Evidence required:** The default fallback if no evidence exists for Options A or B.

**OPTION D: PayMyQR semantics remain UNKNOWN.**
- **Outcome:** We must adopt Option C defensively.

## H. Critical Architectural Question Answer
Because PayMyQR idempotency is currently **NOT PROVEN**, automatic retry of an ambiguous provider request is **NOT PROVEN SAFE** and therefore **MUST NOT be enabled** until sufficient provider evidence exists.
