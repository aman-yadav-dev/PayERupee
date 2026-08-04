# PayERupee Database Design & Schema Specification

**Database Engine:** PostgreSQL (Version 15+)  
**ORM:** Prisma ORM 7 with Driver Adapter (`@prisma/adapter-pg`)  
**Monetary Precision:** `Decimal(18, 4)`  

---

## 1. Entity-Relationship Overview

```
User (Merchant / Admin)
 ├── 1:1 ── Wallet ── 1:N ── WalletTransaction (Immutable Ledger)
 ├── 1:N ── ApiKey
 ├── 1:N ── Payout
 ├── 1:N ── FundRequest
 ├── 1:N ── SupportTicket ── 1:N ── SupportMessage
 └── 1:N ── AuditLog
```

---

## 2. Core Tables & Enums

### Enums
* **`UserRole`**: `ADMIN`, `MERCHANT`
* **`UserStatus`**: `PENDING`, `ACTIVE`, `SUSPENDED`, `DELETED`
* **`PaymentMode`**: `UPI`, `IMPS`, `NEFT`, `RTGS`, `WALLET`, `CARD`
* **`PayoutStatus`**: `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, `REVERSED`
* **`FundRequestStatus`**: `PENDING`, `APPROVED`, `REJECTED`
* **`TransactionType`**: `CREDIT`, `DEBIT`
* **`TransactionCategory`**: `FUND_ADD`, `PAYOUT`, `FEE`, `TAX`, `REFUND`, `ADJUSTMENT`
* **`BlacklistType`**: `UPI`, `BANK_ACCOUNT`, `IFSC`
* **`TicketStatus`**: `OPEN`, `IN_PROGRESS`, `RESOLVED`

---

## 3. Financial Safety Rules in Database

### A. Immutable Ledger
The `WalletTransaction` table records every financial mutation. It does **not** have an `updatedAt` column because rows are strictly append-only.

### B. Optimistic Concurrency Control
The `Wallet` table contains a `version Int @default(1)` column. When multiple concurrent requests attempt to withdraw funds, the version increments atomically, preventing race conditions and double-spending.

### C. Composite Idempotency Constraint
The `Payout` table enforces:
```prisma
@@unique([merchantId, idempotencyKey])
```
This guarantees at the database level that a duplicate request will never result in two separate payouts.

---

## 4. Indexing Strategy

* `WalletTransaction`: `@@index([walletId, createdAt(sort: Desc)])` for fast transaction history rendering.
* `Payout`: `@@index([merchantId, createdAt(sort: Desc)])`, `@@index([merchantId, status])` for high-speed dashboard queries.
* `FundRequest`: `@@index([merchantId, status])`, `@@index([createdAt])` for admin approval queues.
* `ApiKey`: `@@index([merchantId, isActive])` for low-latency API authentication checks.
* `User`: `@@index([deletedAt])` to optimize soft-delete queries.
