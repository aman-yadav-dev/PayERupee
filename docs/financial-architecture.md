# Financial Architecture

## The Double-Entry Ledger System
To guarantee financial integrity, PayERupee will implement a strict double-entry ledger.

### 1. Wallets (The Cache)
- The `Wallet` table stores the `balance`. 
- **Semantics:** This balance is purely a materialized view (a cache) of the ledger designed for fast UI reads. It is NOT the source of truth.

### 2. Ledger Entries (The Source of Truth)
- The `LedgerEntry` model is immutable.
- Every financial movement requires a balanced DEBIT and CREDIT.
- **Example Payout ($100 with $2 fee):**
  - DEBIT Merchant Wallet: $102
  - CREDIT System Transit Account: $100
  - CREDIT System Fee Revenue Account: $2
  - *Total = $0 (System balances).*

### 3. Concurrency & Optimistic Locking
- During concurrent payout requests, relying solely on `db.$transaction` can lead to race conditions if two requests read the balance simultaneously.
- **Solution:** We enforce Optimistic Locking via a `version Int @default(1)` field on the Wallet. The update query enforces `WHERE version = currentVersion`, throwing a `PrismaClientKnownRequestError` if another transaction mutated the wallet first.\n