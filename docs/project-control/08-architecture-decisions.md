# Architecture Decisions

## ADR 1: Outbox Pattern for Payouts
- **Decision**: All provider interactions must go through `payout_outbox` table.

## ADR 2: Strict State Machine
- **Decision**: Payouts follow strict transitions.

## ADR 3: Wallet OCC
- **Decision**: Wallet decrements use optimistic concurrency (`version: { increment: 1 }`).

## ADR 4: Reconciler Boundary
- **Decision**: Webhooks and cron reconciler both emit state events securely.

## ADR 5: AT-MOST-ONCE Dispatch
- **Decision**: The outbox worker is restricted to `attempts = 0` to prevent double-dispatch natively.

## ADR 6: Temporary Safety Policy - No Automatic Retry
- **Decision**: AT-MOST-ONCE remains the TEMPORARY SAFETY POLICY. It is NOT the final architecture decision. Automatic retry is NOT APPROVED. 

## ADR 7: Experimentation Safety Gate
- **Decision**: No real api credentials or financial transactions are allowed without explicit human approval.

## ADR 8: Phase 4 Implementation Blocked
- **Context**: The documented POST creation endpoint returned HTTP 405 in the current production environment.
- **Decision**: Implementation is strictly blocked.
- **Consequence**: PayMyQR integration is halted pending clarification of 12 provider rules (A-L). Final retry architecture is NOT YET DECIDED.
