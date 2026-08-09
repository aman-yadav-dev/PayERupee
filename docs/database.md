# Database Architecture

- **PostgreSQL via Prisma ORM**
- **Representation of Money:** Enforced as `Decimal` (`db.Decimal(18, 4)`). Floating-point types (`Float`) are explicitly banned.
- **Ledger Entries:** Transactions are immutable. Deletions and updates are prohibited; refunds/reversals must be explicit compensatory entries.
- **Soft Deletion:** Used on audit and operational tables via `deletedAt`.\n