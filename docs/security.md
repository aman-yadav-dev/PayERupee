# Security Architecture

## Defense in Depth

1. **Input Validation (Zod):** 
   - All external inputs (Server Actions, API Routes) are strictly validated against Zod schemas in `src/schemas/` before any logic executes.
   
2. **Authorization (Services):**
   - Financial services verify the merchant's `accountStatus` and RBAC permissions. Middleware is NOT a security boundary for data mutation.

3. **Database Integrity (Prisma):**
   - Transactions (`db.$transaction`) ensure atomic updates.
   - Optimistic locking prevents race conditions.

4. **API Security:**
   - External programmatic APIs (`/api/v1/payouts`) are secured via HMAC SHA-256 signatures using the merchant's `Secret Key`, preventing replay attacks and payload tampering.\n