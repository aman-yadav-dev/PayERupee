# 00 Project Status

## Status Flags Reference
* **[CURRENT / VERIFIED]**: Fully verified by codebase inspection.
* **[PARTIAL]**: Partially implemented, missing key boundaries.
* **[UNSAFE]**: Exists but violates system invariants or safety guarantees.
* **[MISSING]**: Code does not exist.
* **[UNKNOWN]**: Cannot be determined from code or lacks external proof.
* **[FUTURE DESIGN]**: Approved design, zero implementation.
* **[BLOCKED BY EXTERNAL INFORMATION]**: Cannot proceed without external confirmation.

## Verified Current Project Status

**[CURRENT / VERIFIED] GitHub `origin/main` vs Local `main` Divergence**
* **GitHub State**: Stopped cleanly at commit `f5fbc3b` (Phase 4: Payout Orchestration complete).
* **Local State**: Currently at `c96d94b` (4 commits ahead). Contains safe Phase 5 and 5.5 structural changes, but also includes unsafe Phase 6 Cashfree logic.
* **Uncommitted/Untracked**: Local changes include modifications to providers and an untracked Reconciler script.

## What Actually Works Today
* **[CURRENT / VERIFIED]** Next.js Auth UI (Login / Register / Onboarding / Pending Approval).
* **[CURRENT / VERIFIED]** Prisma Database Schema (Tenants, Wallets, Ledgers, Payouts).
* **[CURRENT / VERIFIED]** Double-Entry Ledger math constrained by PostgreSQL logic.
* **[CURRENT / VERIFIED]** Payout Orchestration engine (Transitions `PENDING` -> `PROCESSING` -> Network Dispatch).
* **[CURRENT / VERIFIED]** API-Key based Payout Creation API.

## What is Missing / Unsafe Today
* **[UNSAFE]** Local Cashfree implementation relies on unverified terminality and duplicate handling rules.
* **[UNSAFE]** Integration tests mutate a persistent, shared `dev.db`, leading to concurrency risks.
* **[PARTIAL]** Webhook Signature parsing checks HMAC but lacks timestamp replay math.
* **[PARTIAL]** Rate limiting is a completely empty stub.
* **[MISSING]** Merchant and Admin Dashboards.
* **[MISSING]** PayMyQR Provider traces/code.
* **[MISSING]** Reconciliation Infrastructure (`SystemLease` locking or `OutboxEvent` code).
* **[MISSING]** Next.js Edge `middleware.ts`.

## Legacy Document Contradictions
**[CURRENT / VERIFIED] Mandatory Explicit Contradictions in Legacy Documentation:**
1. **Phase 5 Split-Brain**: Legacy `roadmap.md` and `development-phases.md` contradict each other regarding whether Phase 5 was Provider Hardening vs KYC/Admin implementation.
2. **GitHub vs Reality**: Legacy docs claim Phase 5 & 6 are complete, but GitHub remains securely at Phase 4.
3. **Idempotency vs Replay**: Legacy security docs falsely conflate API idempotency (creation deduplication) with Webhook cryptographic replay protection (timestamp freshness).
4. **Architecture Outdated**: Legacy architecture docs ignore the Phase 5.5 `src/modules/` Domain-Driven reality.
5. **Middleware Illusion**: Legacy docs refer to middleware intercepting requests, but no `middleware.ts` exists in the codebase.
