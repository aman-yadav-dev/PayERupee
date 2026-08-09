# Concurrency Controls

- **Database Transactions:** Multi-table updates execute exclusively within `db.$transaction`.
- **Optimistic Locking:** The `Wallet` model uses a `version` integer. Updates strictly enforce `WHERE version = currentVersion` to prevent race conditions during concurrent balance deductions.\n