# Known Problems (Audit Results)

1. **Fat Actions in Auth:** `register.ts` and `onboarding.ts` execute direct Prisma transactions and contain business logic.
2. **Prisma Schema Coupling:** The `User` model mixes Better Auth fields with PayERupee domain fields (`businessName`, `kycApprovedAt`).
3. **Ledger Immaturity:** `WalletTransaction` is a single-entry model, lacking true double-entry mechanics (Debit/Credit offsets).\n