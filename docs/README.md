# PayERupee Documentation

Welcome to the central documentation for PayERupee. 

PayERupee is a scalable, secure payout orchestration platform built as a modular monolith using Next.js, Prisma, and PostgreSQL. It utilizes a strict double-entry ledger system and Optimistic Concurrency Control (OCC) to guarantee mathematical financial safety.

## Core Architecture Documents

A future developer should be able to deeply understand PayERupee by reading these documents in order:

1. [Architecture Overview](./architecture-overview.md) - High-level layered architecture, modular monolith design, and scaling strategy.
2. [Database & ER Model](./database-er-model.md) - The permanent Prisma schema, financial invariants, and transaction boundaries.
3. [Payout Lifecycle](./payout-lifecycle.md) - The end-to-end state machine (PENDING → PROCESSING → SUCCESS/FAILED/REVERSED).
4. [Provider Architecture](./provider-architecture.md) - How we integrate external PSPs (e.g., Razorpay, Cashfree) safely using `IPayoutProvider`.
5. [Security Architecture](./security-architecture.md) - API authentication, Webhook cryptographic verification, and IDOR protection.
6. [Master Roadmap](./roadmap.md) - The 10-phase progression of the platform from inception to hyperscale.

## Architecture Decision Records (ADRs)

Our core technical choices are permanently documented in the ADRs. If you intend to change a fundamental system behavior, read the corresponding ADR first.

- [ADR-001: Modular Monolith](./adrs/001-modular-monolith.md)
- [ADR-002: PostgreSQL & Prisma](./adrs/002-postgresql-prisma.md)
- [ADR-003: Double-entry Ledger](./adrs/003-double-entry-ledger.md)
- [ADR-004: Optimistic Concurrency Control](./adrs/004-optimistic-concurrency-control.md)
- [ADR-005: Payout State Machine](./adrs/005-payout-state-machine.md)
- [ADR-006: Provider Abstraction](./adrs/006-provider-abstraction.md)
- [ADR-007: Provider Calls Outside DB Transactions](./adrs/007-provider-calls-outside-db-transactions.md)
- [ADR-008: Idempotency Strategy](./adrs/008-idempotency-strategy.md)
- [ADR-009: Webhook Security](./adrs/009-webhook-security.md)
- [ADR-010: Reconciliation Model](./adrs/010-reconciliation-model.md)
- [ADR-011: Provider-Agnostic Architecture](./adrs/011-provider-agnostic-architecture.md)
- [ADR-012: No Premature Microservices](./adrs/012-no-premature-microservices.md)
