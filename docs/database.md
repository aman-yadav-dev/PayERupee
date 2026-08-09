# Database Architecture

## Money Representation
- **Type:** `Decimal` (`db.Decimal(18, 4)`).
- **Rule:** Floating-point numbers (`Float`) are strictly prohibited due to IEEE 754 rounding errors.
- **Precision:** 18 total digits, 4 decimal places to handle micro-fees and fractional taxes.

## Ledger Immutability
- Financial transaction records (`LedgerEntry`) are **append-only**.
- No `UPDATE` or `DELETE` is allowed on ledger rows. 
- Refunds or reversals must be enacted by appending a compensatory `LedgerEntry`.\n