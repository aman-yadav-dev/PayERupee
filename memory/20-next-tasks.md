# Next Tasks

*Do not begin these tasks until the architecture phase is fully signed off.*

1. **Refactor Prisma Schema:** Split `User` and `MerchantProfile`. Introduce `LedgerEntry` and `SystemAccount` for double-entry accounting.
2. **Establish Service Layer:** Create `src/services/auth.service.ts` and `src/services/wallet.service.ts`.
3. **Refactor Actions:** Strip all Prisma calls from `src/actions/auth/*` and route them through the new services.\n