# PayERupee Release Notes

All notable releases and architectural milestones for PayERupee are documented in this file.

---

## [v0.1.0] - 2026-08-04

### Initial MVP Foundation & Architecture Freeze

#### Added
* **Project Scaffolding:** Next.js 15 App Router setup with React 19, TypeScript strict mode, and Tailwind CSS v4.
* **Database & ORM:** PostgreSQL database configuration using Prisma 7 with Driver Adapter (`@prisma/adapter-pg`) and Neon connection pooling.
* **Schema Design:** Implemented User, Wallet, WalletTransaction (Immutable Ledger), FundRequest, Payout, ApiKey, and AuditLog models.
* **Security & Auth:** Configured Better Auth with defensive error recovery (preventing "Zombie Auth" accounts), bcrypt password hashing, and Zod startup environment validation.
* **Frontend Design System:** Built responsive, animated public Landing Page using Framer Motion and Lucide icons.
* **Standardization:** Centralized standardized API response factory (`src/lib/responses.ts`).
