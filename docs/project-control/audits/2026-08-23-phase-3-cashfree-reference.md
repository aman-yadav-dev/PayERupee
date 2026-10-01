# Phase 3 Provider Boundary Audit
**Date:** 2026-08-23

## A. Provider Architecture
The application defines a generic `IPayoutProvider` boundary. Currently, only the `CashfreePayoutProvider` is implemented. A mock provider exists for tests.

## B. Provider Interface
The `IPayoutProvider` contract defines four methods: `dispatch`, `status`, `verifyWebhookSignature`, and `parseWebhook`. The interface forces normalized outcomes (`SUCCESS`, `REJECTED`, `QUEUED`, `TIMEOUT`, `NETWORK_ERROR`, `NOT_FOUND`).

## C. Cashfree Behavior (Source-Backed)
1. **Is dispatch idempotent?** **[FACT — OFFICIAL PROVIDER DOCUMENTATION]** Yes, but *only* if the `x-idempotency-key` header is provided.
2. **Official idempotency mechanism?** **[FACT — OFFICIAL PROVIDER DOCUMENTATION]** Cashfree mandates a UUID passed in the `x-idempotency-key` header.
3. **Is transfer_id unique?** **[FACT — OFFICIAL PROVIDER DOCUMENTATION]** Yes, Cashfree enforces uniqueness for `transfer_id`.
4. **What happens if same transfer_id is submitted twice?** **[FACT — OFFICIAL PROVIDER DOCUMENTATION]** Cashfree rejects the second request with a `DUPLICATE_TRANSFER` error.
5. **Does Cashfree guarantee duplicate rejection?** **[FACT — OFFICIAL PROVIDER DOCUMENTATION]** Yes.
6. **What happens if the request times out after Cashfree receives it?** **[FACT — OFFICIAL PROVIDER DOCUMENTATION]** It executes. Retrying with the same `x-idempotency-key` will safely return the cached response.
7. **What happens if HTTP response is lost?** **[FACT — OFFICIAL PROVIDER DOCUMENTATION]** Same as 6.
8. **Is successful transfer discoverable?** **[FACT — SOURCE CODE]** Yes, via the `status` GET API.
9. **What does NOT_FOUND actually mean?** **[UNKNOWN / NOT PROVEN]** It could mean the request was never received, or it could mean eventual consistency lag on their read replicas.
10. **Can NOT_FOUND occur due to eventual consistency?** **[UNKNOWN / NOT PROVEN]**
11. **Are status responses authoritative?** **[ASSUMPTION]** Yes.
12. **Are provider statuses terminal?** **[ASSUMPTION]** `SUCCESS`, `FAILED` are assumed terminal.
13. **Can SUCCESS later become FAILED/REVERSED?** **[FACT — SOURCE CODE]** Yes, Cashfree sends a `TRANSFER_REVERSED` webhook, which is natively supported in our adapter.
14. **Can REJECTED later become SUCCESS?** **[UNKNOWN / NOT PROVEN]**
15. **What are the retry recommendations?** **[FACT — OFFICIAL PROVIDER DOCUMENTATION]** Retry with the exact same `x-idempotency-key`.
16. **Webhook retry semantics?** **[UNKNOWN / NOT PROVEN]** Standard webhook delivery assumes AT-LEAST-ONCE.
17. **Can webhooks arrive more than once?** **[EXTERNAL DEPENDENCY]** Yes.
18. **Can webhooks arrive out of order?** **[EXTERNAL DEPENDENCY]** Yes.
19. **How should webhook authenticity be verified?** **[FACT — SOURCE CODE]** Validated via `x-webhook-signature` using HMAC SHA256 of the timestamp and raw payload.
20. **What fields uniquely identify a provider transaction?** **[FACT]** `transfer_id` (our DB `payout.id`) and `reference_id` (their `providerReference`).
21. **Is providerReference guaranteed unique?** **[ASSUMPTION]** Yes.
22. **Are there provider-side reconciliation APIs?** **[UNKNOWN / NOT PROVEN]** We rely solely on the `status` endpoint.
23. **What are the documented timeout/error semantics?** **[FACT — SOURCE CODE]** 4xx denotes validation rejection. 5xx denotes ambiguous timeout/network failure.

## D. PayMyQR Behavior
**[NOT PROVEN]** The PayMyQR adapter does not exist in the codebase.

## E. Network Failure Matrix

| Scenario | Our System Action | Cashfree Action | Provider Execution |
|----------|-------------------|-----------------|---------------------|
| A. Never leaves server | Outbox attempts=1 (EXHAUSTED). Reconciler polls -> `NOT_FOUND` -> Stays `PROCESSING` forever. | None | N/A |
| B. Leaves server, never reaches provider | Same as A. | None | N/A |
| C. Provider receives, response lost | Outbox EXHAUSTED. Reconciler polls -> gets true status and completes payout. | Processes transfer | AT-MOST-ONCE |
| D. Provider accepts -> SUCCESS | Outbox completes payout inline. | Processes transfer | EXACTLY-ONCE |
| F. Provider rejects -> REJECTED | Outbox fails payout inline. | Rejects transfer | N/A |
| G/H/I. Network Timeouts | Outbox EXHAUSTED. Reconciler fixes. | Processes transfer | AT-MOST-ONCE |
| J/K/L. Process Crashes | Sweeper skips due to `attempts > 0`. Reconciler fixes if received, hangs if not. | Depends on timing | AT-MOST-ONCE |
| M. Duplicate Dispatch | Blocked by Outbox OCC. | Blocked by `transfer_id` | N/A |
| N/O. Duplicate/Race Webhooks | Safely ignored via `IllegalStateTransitionError`. | Sends webhook | AT-LEAST-ONCE |

## F. Dispatch Guarantee Classification
- **Our System:** **[AT-MOST-ONCE]**
- **Cashfree:** Capable of **[EXACTLY-ONCE]**, but we currently do not use their idempotency header.

## G. Webhook Guarantee Classification
- **Our System:** **[EXACTLY-ONCE]** state transition (enforced by DB OCC).
- **Cashfree:** **[AT-LEAST-ONCE]** delivery.

## H. Reconciliation Implications
The Reconciler safely heals payouts that reached Cashfree but timed out. **However**, because our Outbox never retries, payouts that crashed *before* reaching Cashfree will return `NOT_FOUND` to the Reconciler. The Reconciler correctly treats this as ambiguous to prevent double-spends, but this traps the payout in `PROCESSING` permanently, requiring manual intervention.

## I. Financial Safety Implications
The architecture is phenomenally safe against platform double-spends. However, the extreme defense mechanism creates a severe UX hazard where trivial network drops permanently lock merchant funds in transit.

## J. Current Architecture Strengths
- Structurally immune to double-dispatch.
- Immune to duplicate/out-of-order webhooks.

## K. Current Architecture Weaknesses
**[UNSAFE]** `cashfree.provider.ts` does **not** send the `x-idempotency-key` header.
Because of this omission, our Outbox cannot safely retry requests, forcing us to rely on the Reconciler, which cannot safely recover un-sent requests.

## L. Unsafe Behavior
Merchant funds will become permanently locked in `PROCESSING` state if a network request fails before Cashfree registers the `transfer_id`.

## M. Unknown / Not Proven Behavior
We do not know if Cashfree's `NOT_FOUND` response is strongly consistent or eventually consistent. This justifies our Reconciler's cautious approach.

## N. External Dependencies
- Cashfree API `x-idempotency-key` support.

## O. Recommended Architectural Alternatives
1. **Add Idempotency Key:** Modify `cashfree.provider.ts` to include `x-idempotency-key: payoutId`.
2. **Enable Safe Retries:** Modify `outbox.processor.ts` to retry dispatch on `NETWORK_ERROR` or `TIMEOUT` up to 5 times.
This completely resolves the "stranded in PROCESSING" issue while remaining mathematically safe against double-spends.

## P. Whether Current Outbox Strategy Should Remain
The Outbox pattern is correct. It should remain, but its execution strategy should be upgraded from AT-MOST-ONCE to EXACTLY-ONCE via provider idempotency keys.

## Q. Whether Retrying Dispatch is Safe
**[NOT PROVEN]** It is currently **UNSAFE** because the header is missing. It becomes highly safe once the header is added.

## R. Whether Reconciliation Assumptions are Valid
Treating `NOT_FOUND` as ambiguous is correct and safe. The architectural flaw is in the Outbox's inability to retry, not the Reconciler's caution.

## S. Exact Evidence
- Cashfree Official Documentation regarding `x-idempotency-key` for safe retries.
- Code inspection of `src/modules/provider/adapters/cashfree.provider.ts` showing missing headers.
- Code inspection of `src/modules/payout/application/outbox.processor.ts` showing `attempts: 1` lockout.
