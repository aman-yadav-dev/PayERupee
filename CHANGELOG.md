# Changelog

All notable changes to the **PayERupee** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-08-04

### Added
- Initialized Next.js 15 App Router architecture with TypeScript strict mode.
- Designed PostgreSQL schema with Prisma ORM 7 supporting User, Wallet, WalletTransaction, FundRequest, Payout, ApiKey, and AuditLog.
- Implemented Prisma 7 Driver Adapter with Neon connection pooling.
- Configured Better Auth with defensive error recovery for user registration.
- Added strict Zod startup validation for environment variables (`src/config/env.ts`).
- Created high-performance landing page with Framer Motion animations.
- Set up standardized API response builder (`src/lib/responses.ts`).
- Added comprehensive project documentation suite (`docs/`).
