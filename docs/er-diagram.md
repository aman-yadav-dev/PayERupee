# Target Entity Relationship Diagram

```mermaid
erDiagram
    %% Identity 
    User ||--o{ Session : has
    User ||--o{ Account : has
    
    %% Domain
    User ||--o| MerchantProfile : owns
    MerchantProfile ||--o| KycApplication : submits
    
    %% Financial Ledger 
    MerchantProfile ||--o| Wallet : accesses_cache
    MerchantProfile ||--o| LedgerAccount : owns_liability_account
    
    %% Immutable Entries
    LedgerAccount ||--o{ LedgerEntry : debits_or_credits
    
    %% Operations
    MerchantProfile ||--o{ Payout : initiates
    Payout ||--o| IdempotencyKey : guarded_by
    Payout }|--|| LedgerEntry : generates
    
    %% Audit
    User ||--o{ AuditLog : performs
```\n