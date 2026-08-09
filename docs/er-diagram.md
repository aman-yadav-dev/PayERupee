# Entity Relationship Diagram

```mermaid
erDiagram
    %% Authentication
    User ||--o{ Session : has
    User ||--o{ Account : has
    
    %% Domain
    User ||--o| MerchantProfile : owns
    MerchantProfile ||--o| KycApplication : submits
    MerchantProfile ||--o| Wallet : holds
    
    %% Ledger
    Wallet ||--|{ LedgerEntry : participates_in
    SystemAccount ||--|{ LedgerEntry : participates_in
    
    %% Transactions
    MerchantProfile ||--o{ Payout : initiates
    Payout ||--o| IdempotencyKey : guarded_by
    Payout }|--|| LedgerEntry : generates
```\n