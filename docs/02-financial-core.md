# 02 Financial Core

## Status Flags
* **[CURRENT / VERIFIED]**: Implemented and functioning.

## Tenancy and Ledger
**[CURRENT / VERIFIED] MerchantProfile Tenancy**
All financial activity is anchored to a `MerchantProfile`. Financial models (`Wallet`, `Payout`) enforce isolation via a mandatory `merchantProfileId` foreign key.

**[CURRENT / VERIFIED] Double-Entry Accounting**
* **Wallet**: Concrete balance tracker for a merchant.
* **LedgerAccount**: Abstract representations (e.g., Merchant Wallet, Escrow, Fees).
* **LedgerEntry**: Immutable double-entry row containing `debitAccountId` and `creditAccountId`.
Transactions strictly create paired double-entry records while utilizing Postgres decrement/increment constraints on the Wallet balance.

```mermaid
erDiagram
    MerchantProfile ||--o{ Wallet : "owns"
    MerchantProfile ||--o{ Payout : "creates"
    LedgerAccount ||--o| Wallet : "maps to"
    LedgerAccount ||--o{ LedgerEntry : "debits/credits"
    Payout ||--o{ LedgerEntry : "triggers"
```

## Prisma Transaction Boundaries

**[CURRENT / VERIFIED] Atomic Balance Operations**
* **Wallet Debit**: Wrapped in a Prisma `$transaction`. Includes Idempotency check (`findUnique`), creating two `LedgerEntry` rows, and atomic `decrement` of the Wallet balance.
* **Wallet Credit/Refund**: Prisma `$transaction` inserting reversal `LedgerEntry` rows and atomic `increment` of the Wallet balance.

```mermaid
sequenceDiagram
    participant API
    participant Controller
    participant PayoutService
    participant WalletService
    participant Prisma

    API->>Controller: POST /api/v1/payouts
    Controller->>PayoutService: createPayout()
    PayoutService->>Prisma: Idempotency Check (db.payout.findUnique)
    PayoutService->>WalletService: debitWallet(amount)
    WalletService->>Prisma: $transaction(Create 2x LedgerEntry)
    WalletService->>Prisma: $transaction(Atomic Balance Decrement)
    PayoutService->>Prisma: Insert Payout (status: PENDING)
```

## Payout State Machine

**[CURRENT / VERIFIED] CAS State Transitions**
Payout state transitions are governed by Compare-And-Swap (CAS) logic. For example, a webhook transitioning a payout to `SUCCESS` requires a `WHERE status = 'PROCESSING'` constraint in Prisma.

* `PENDING`: Initial state upon DB insert.
* `PROCESSING`: Transitioned by Orchestrator before network dispatch.
* `SUCCESS`: Transitioned by Orchestrator (synchronous mock) or Webhook (asynchronous).
* `FAILED`: Transitioned by Webhook or immediate provider rejection.

```mermaid
stateDiagram-v2
    [*] --> PENDING : createPayout() + Debit
    PENDING --> PROCESSING : dispatchPayout() (CAS)
    PROCESSING --> SUCCESS : Webhook / Mock Success (CAS)
    PROCESSING --> FAILED : Webhook / Rejection (CAS) + Refund
    FAILED --> [*]
    SUCCESS --> [*]
```
