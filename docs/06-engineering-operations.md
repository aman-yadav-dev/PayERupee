# 06 Engineering and Operations

## Status Flags
* **[CURRENT / VERIFIED]**: Actual implementation reality.
* **[UNSAFE]**: Exists but violates system invariants or safety guarantees.
* **[UNKNOWN]**: Target architecture unverified.

## Testing Architecture

**[CURRENT / VERIFIED] Vitest Environment**
The project utilizes Vitest for integration and concurrency testing. 

**[UNSAFE] Test Database Isolation Problem**
* **Shared State**: The integration tests (e.g., `ledger.service.test.ts`, `orchestrator.test.ts`, `wallet-concurrency.test.ts`) execute against a persistent, shared `dev.db` PostgreSQL instance.
* **Hazard**: There is no ephemeral schema generation, transaction rollback mechanism, or parallel isolation implemented in `vitest.config.ts`. Running the test suite concurrently risks severe state collisions. 

## Observability and Logging

**[PARTIAL] Logger Stub**
A basic logger is located at `src/infrastructure/logger.ts`.

**[MISSING] Observability Gaps**
There is no APM (Application Performance Monitoring), structured JSON logging configured for production, or OpenTelemetry instrumentation currently implemented.

## Environment and Deployment

**[CURRENT / VERIFIED] Configuration**
Environment variables are managed and strictly typed via `src/config/env.ts` using Zod validation.

**[UNKNOWN] Deployment Targets**
Specific deployment infrastructure rules (e.g., Vercel edge compatibility, AWS EventBridge for crons, production Redis clusters for rate limiting) are not yet codified in the repository.
