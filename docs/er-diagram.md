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
    MerchantProfile ||--o{ LedgerAccount : owns
    LedgerAccount ||--o| Wallet : mapped_to_cache
    
    %% Immutable Entries
    LedgerAccount ||--o{ LedgerEntry : participates_in
    
    %% Operations
    MerchantProfile ||--o{ Payout : initiates
    Payout ||--|{ LedgerEntry : generates
    
    %% Audit
    User ||--o{ AuditLog : performs
```\n