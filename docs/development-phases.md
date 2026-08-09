# Development Phases

The project follows a strict iterative rollout. The architecture and documentation must be fully frozen (Phase 0) before Phase 1 begins.

- **Phase 0:** Architecture & documentation freeze. (CURRENT)
- **Phase 1:** Database & Domain foundation (Refactoring Prisma schema for MerchantProfile and double-entry Ledger).
- **Phase 2:** Service layer foundation (Building `src/services/` for Wallet, Auth, and Ledger operations).
- **Phase 3:** Authentication & Authorization (Refactoring Server Actions to consume the Phase 2 Service layer).
- **Phase 4:** Payout Engine Engine (Idempotent API disbursals).
- **Phase 5:** Admin & KYC Approval operations.\n