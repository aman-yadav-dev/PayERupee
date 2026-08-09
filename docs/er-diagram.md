# Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Session : has
    User ||--o{ MerchantProfile : owns
    MerchantProfile ||--o| KycApplication : submits
    MerchantProfile ||--o| Wallet : holds
    Wallet ||--o{ LedgerEntry : logs
    Wallet ||--o{ Payout : initiates
    Payout ||--o| IdempotencyKey : guarded_by
```\n