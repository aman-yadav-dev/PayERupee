# Validation of Crash Windows & Network Semantics
**Date:** 2026-08-23

## 1. The AT-MOST-ONCE Dispatch Assessment
The system natively prevents double-dispatch by setting `attempts = 1` during the initial `processPayout` transaction, and using atomic `attempts: { increment: 1 }` in the background worker. This ensures that only the *first* process to claim the event can ever execute `provider.dispatch()`.

### Exact Crash-Window Matrix

| Scenario | Network Dispatch Semantics | Explanation |
| :--- | :--- | :--- |
| **1. Crash before provider request sent** | AT-MOST-ONCE (Zero dispatches) | `attempts` is 1. Next worker increments to 2, skips dispatch, marks `EXHAUSTED`. |
| **2. Crash while request is being sent** | AT-MOST-ONCE (Zero or One) | Next worker reads `attempts >= 1`, marks `EXHAUSTED`. Reconciler resolves state. |
| **3. Provider receives request but client crashes** | AT-MOST-ONCE (Exactly One) | Next worker skips. Reconciler polls provider and recovers outcome. |
| **4. Provider processes request, response lost** | AT-MOST-ONCE (Exactly One) | App treats as TIMEOUT/NETWORK_ERROR. Next worker skips. Reconciler recovers outcome. |
| **5. Provider returns SUCCESS, app crashes before DB** | AT-MOST-ONCE (Exactly One) | Next worker skips. Reconciler polls `SUCCESS` and handles wallet compensation. |
| **6. DB update succeeds, process crashes afterward** | AT-MOST-ONCE (Exactly One) | Outbox is `COMPLETED`. State is terminal. |
| **7. Worker lock expires while worker is alive** | AT-MOST-ONCE (Exactly One) | Alive worker executes dispatch. Next worker claims, increments `attempts`, and skips dispatch gracefully. |
| **8. Two workers race to claim event** | AT-MOST-ONCE (Exactly One) | Postgres `updateMany` guarantees atomic exclusive lock and increment. Loser skips. |
| **9. DB connection drops during claim** | AT-MOST-ONCE (Zero or One) | Worker aborts before dispatch. Next worker can safely claim later. |
| **10. DB connection drops after claim, before request** | AT-MOST-ONCE (Zero dispatches) | Worker aborts. Next worker reads `attempts >= 1` and skips. |
| **11. DB connection drops after request** | AT-MOST-ONCE (Exactly One) | App cannot save `COMPLETED`. Reconciler polls outcome. |
| **12. Provider times out after receiving request** | AT-MOST-ONCE (Exactly One) | App catches error, `attempts` prevents retry. Reconciler polls. |
| **13. Provider returns unparseable JSON** | AT-MOST-ONCE (Exactly One) | App catches error. Reconciler polls. |
| **14. Worker/Application restarts** | AT-MOST-ONCE | Safe handoff to next worker or Reconciler based on DB state. |

## 2. The AT-MOST-ONCE Trade-Off (Safety vs Liveness)
If the application crashes *between* DB commit and `provider.dispatch()`, the event is never sent.
- **OutboxEvent:** Next worker marks it `EXHAUSTED`.
- **Payout:** Stays `PROCESSING`.
- **Wallet:** Funds remain locked in `SYSTEM_TRANSIT`.
- **Reconciler:** Polls `provider.status()`.
- **Provider Status:** Returns `NOT_FOUND` (since it never received it).
- **Result:** The Reconciler classifies `NOT_FOUND` as an ambiguous unknown, bumps `updatedAt`, and leaves the payout `PROCESSING`.
- **Assessment:** This is **100% Financially Safe** (no duplicate payout). However, it is a **Severe Liveness Failure**. The payout is permanently deadlocked and the merchant's funds are frozen until manual administrative intervention occurs. Automated recovery is intentionally disabled for this path to guarantee AT-MOST-ONCE safety.

## 3. Database Safety vs Provider Safety

| Domain | Assessment | Why |
| :--- | :--- | :--- |
| **A. Database state safety** | [PROVEN] | Postgres ACID guarantees. |
| **B. Ledger safety** | [PROVEN] | Committed atomically with Payout. |
| **C. Wallet compensation safety** | [PROVEN] | Version OCC (`version: { increment: 1 }`). |
| **D. Payout state transition safety** | [PROVEN] | State OCC (`where: { status: PENDING/PROCESSING }`). |
| **E. Outbox execution safety** | [PROVEN] | Postgres row-level locks + atomic `increment`. |
| **F. Network dispatch semantics** | [PROVEN] | Strictly AT-MOST-ONCE. |
| **G. Provider-side duplicate protection**| [UNKNOWN] | We cannot prove Cashfree's internal system behavior. |
| **H. EXACTLY-ONCE PROVIDER EXECUTION** | [NOT PROVEN] | We only guarantee we *send* it at-most-once, and we *reconcile* it exactly-once internally. We cannot guarantee the provider executes it exactly-once internally. |

## 4. Cashfree External Dependencies & Unknowns
The following are strictly [UNKNOWN] and rely entirely on external provider documentation/infrastructure:
- Duplicate transfer behavior
- Provider-side idempotency
- Terminality of statuses
- Webhook ordering & replay semantics
- Timeout semantics & status propagation delay
- `NOT_FOUND` semantics (Does it mean definitely not received, or just eventual consistency delay?)
