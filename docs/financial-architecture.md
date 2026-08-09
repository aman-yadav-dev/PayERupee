# Financial Architecture

## The Double-Entry Ledger
To guarantee financial integrity, PayERupee uses a double-entry ledger system.

1. **Wallet:** A materialized view (cache) of a merchant's balance for fast UI reading.
2. **LedgerAccount:** Represents abstract financial accounts (e.g., "Merchant Wallet A", "System Revenue Account", "System Escrow").
3. **LedgerEntry:** An immutable record requiring both a DEBIT and a CREDIT that balance to zero.

When a payout occurs:
- DEBIT Merchant LedgerAccount
- CREDIT System Payout Transit Account\n