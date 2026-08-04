# PayERupee System Architecture & Engineering Blueprint

**System Name:** PayERupee  
**System Classification:** B2B Payout Gateway & Multi-Tenant Financial Disbursal Engine  
**Architecture Pattern:** Feature-Sliced Modular Monolith  

---

## 1. High-Level Architecture Overview

PayERupee provides automated bank disbursals, instant payouts, and multi-tenant ledger management. The system is built as a **Modular Monolith** using Next.js 15 App Router, combining Server-Side Rendering (SSR), React Server Components (RSC), Server Actions for UI mutations, and REST Route Handlers for external API consumers.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          INCOMING TRAFFIC                              │
├────────────────────────────────┬───────────────────────────────────────┤
│    Merchant & Admin Web UI     │        Merchant Server / API SDKs     │
└───────────────┬────────────────┴───────────────────┬───────────────────┘
                │                                    │
                ▼                                    ▼
┌────────────────────────────────┐  ┌────────────────────────────────────┐
│      Next.js Server Actions    │  │    REST Route Handlers (/api/v1)   │
│   (Form State, useTransition)  │  │  (Idempotency-Key & API Key Auth)  │
└───────────────┬────────────────┘  └────────────────┬───────────────────┘
                │                                    │
                └─────────────────┬──────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FEATURE DOMAIN LOGIC (src/features)                  │
│   • Wallet & Ledger Math        • Payout State Machine                 │
│   • Tax & Fee Engine            • Fraud & Blacklist Engine             │
│   • Support Ticket & Chat       • Analytics & Report Generator         │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     DATA ACCESS & PERSISTENCE                          │
│   • Prisma ORM (Atomic Transactions with @prisma/adapter-pg)           │
│   • PostgreSQL Database (ACID Storage & Optimistic Locking)            │
│   • Redis (Balance Read-Through Cache & Rate Limiting)                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive Module Breakdown

### 🏢 A. Merchant Portal (`src/app/(merchant)`)

| Module | Route | Key Features & Responsibilities |
| :--- | :--- | :--- |
| **1. Dashboard** | `/dashboard` | • Real-time metrics cards: Total Balance, Today's Payouts, This Month Payouts, Success Ratios.<br>• Interactive charts: Hourly transaction trends, status distribution.<br>• Recent activity feed. |
| **2. Wallet & Funds** | `/wallet` | • Live available balance in INR with optimistic locking.<br>• **Add Funds Form**: Submit UTR number and transfer mode for admin approval.<br>• **Add Fund History**: Table showing all historical top-up requests and status (`PENDING`, `APPROVED`, `REJECTED`). |
| **3. Payouts Engine** | `/payouts` | • **Single Payout Form**: Instant payout to Account+IFSC or UPI with live name validation.<br>• **Bulk Payout (CSV)**: Streaming parser for bulk batch uploads (1,000+ rows).<br>• Real-time status tracking via state machine (`PENDING` ➔ `PROCESSING` ➔ `SUCCESS` / `FAILED`). |
| **4. Master Transactions** | `/transactions` | • Immutable ledger feed of all Credits, Debits, Fees, and Taxes.<br>• Multi-parameter filtering: Date range, status, payment mode, amount range.<br>• **Report Generation**: Export filtered data to CSV/Excel. |
| **5. Developer Portal** | `/developer` | • Live & Test API Key generation with masked key display (`paye_live_...`).<br>• Interactive REST documentation & sample code snippets (cURL, Node.js, Python).<br>• Outgoing webhook configuration and sandbox test mode. |
| **6. Security & Fraud** | `/security` | • **IP Whitelisting**: Lock API requests to approved server IPs.<br>• **Velocity Limits**: Daily and per-transaction maximum/minimum payout limits.<br>• **Merchant Blacklist**: Ban known fraudulent UPI IDs or bank accounts from receiving money. |
| **7. Direct Support Chat** | `/support` | • Integrated real-time ticketing and chat interface to communicate directly with Super Admins regarding transaction disputes or queries. |
| **8. Profile & KYC** | `/profile` | • Registered business entity information, GSTIN, and address.<br>• KYC status verification indicator (`PENDING` vs `ACTIVE`).<br>• Password management & permanent account deletion request. |

---

### 🛡️ B. Super Admin Command Center (`src/app/(admin)`)

| Module | Route | Key Features & Responsibilities |
| :--- | :--- | :--- |
| **1. Master Dashboard** | `/admin/dashboard` | • God-mode platform metrics: System-wide floating wallet balance, total transaction volume, total active vs suspended merchants.<br>• **Revenue & Fee Aggregation**: Total gateway fees and taxes collected.<br>• Urgent alerts for unapproved KYC and pending fund top-ups. |
| **2. Merchant Management** | `/admin/merchants` | • Complete merchant directory with contact, business name, and wallet balances.<br>• **KYC Moderation**: Review and approve newly registered merchants.<br>• **Emergency Kill-Switch**: Suspend fraudulent merchants (instantly revokes API keys and freezes balance). |
| **3. Fund Approval Queue** | `/admin/funds` | • High-priority queue of merchant fund deposit requests.<br>• Cross-reference bank UTR numbers against real bank accounts.<br>• **Atomic Approval Action**: Automatically mints funds into merchant wallet and creates ledger credit entry. |
| **4. Master Platform Ledger** | `/admin/transactions` | • Centralized ledger of every transaction across all merchants.<br>• Global search by UTR, Payout ID, Bank Reference, or Merchant ID.<br>• Platform-wide reconciliation audits. |
| **5. Global Blacklist Manager** | `/admin/blacklist` | • Platform-wide ban list for fraudulent UPI IDs, Bank Accounts, and IFSC codes.<br>• Blocks payouts across **ALL** merchants if a beneficiary matches the global blacklist. |
| **6. Support Helpdesk** | `/admin/support` | • Centralized inbox to view and respond to incoming support tickets and chats from merchants. |
| **7. Platform Taxes & Fees** | `/admin/settings` | • **Tax Configuration**: Set platform-level GST/tax percentages on transactions and fund deposits.<br>• **Fee Rules**: Configure per-mode flat and percentage fees (UPI, IMPS, NEFT, RTGS). |
| **8. Merchant-Wise Reports** | `/admin/reports` | • Generate comprehensive financial and tax reports per merchant for specified fiscal quarters or date ranges. |

---

### 🌐 C. External Gateway API (`/api/v1`)

* `POST /api/v1/payouts`: Automated single payout initiation (enforces `X-API-KEY` and `Idempotency-Key`).
* `GET /api/v1/payouts/{id}`: Check real-time payout status and bank UTR reference.
* `GET /api/v1/balance`: Fetch real-time available wallet balance.
* `POST /api/v1/auth/[...all]`: Better Auth handler for session and authentication lifecycle.
* `POST /api/v1/webhooks`: Inbound banking provider status updates.

---

## 3. Core Fintech Security Rules

1. **Immutable Append-Only Ledger:** Balances are never modified in isolation. Every credit and debit creates an immutable record in `WalletTransaction`.
2. **Two-Tier Idempotency:**
   - External APIs require the `Idempotency-Key` header.
   - Database enforces `@@unique([merchantId, idempotencyKey])`.
3. **Explicit State Transitions:**
   $$\text{PENDING} \longrightarrow \text{PROCESSING} \longrightarrow \text{SUCCESS} \mid \text{FAILED} \mid \text{REVERSED}$$
4. **Arbitrary-Precision Arithmetic:** Monetary columns use PostgreSQL `Decimal(18, 4)` to eliminate IEEE-754 floating-point inaccuracies.
5. **Zero Trust & Edge Security:** Middleware checks sessions and user roles at the edge before any route renders.
