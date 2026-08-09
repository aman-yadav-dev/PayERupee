# Database Architecture

## Prisma & PostgreSQL
PayERupee utilizes PostgreSQL for strict ACID compliance, accessed via Prisma ORM.

## Money Representation (CRITICAL)
- **Type:** `Decimal` (`db.Decimal(18, 4)`).
- **Rule:** Floating-point numbers (`Float`) are strictly prohibited due to IEEE 754 rounding errors.
- **Precision:** 18 total digits, 4 decimal places. This allows handling micro-fees, precise tax calculations, and fractional currency splits without losing pennies.

## Idempotency Constraints
- Network retries are a reality in fintech.
- Models like `Payout` enforce uniqueness on `[merchantId, idempotencyKey]` to guarantee that a double-click or network retry never results in a double-charge.

## Soft Deletion
- We employ `deletedAt DateTime?` instead of hard deletes for all financial and audit-related tables to maintain historical integrity.\n