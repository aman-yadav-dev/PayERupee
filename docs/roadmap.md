# PayERupee Development Roadmap (6-Week Plan)

This roadmap outlines the path from initial project scaffolding to a fully functioning B2B Payout Gateway MVP.

---

```
Week 1          Week 2          Week 3          Week 4          Week 5          Week 6
[Auth & DB] ──► [Wallet/Ledger] ──► [Payout Engine] ──► [Analytics/Chat] ──► [Admin Center] ──► [API & Launch]
```

---

### Week 1: Foundation, Database & Authentication
- [x] Next.js 15 + Tailwind CSS + shadcn/ui setup.
- [x] PostgreSQL & Prisma 7 Driver Adapter configuration.
- [x] Better Auth backend and Zod environment validation.
- [ ] Upgrade Login & Registration pages with password toggles, `useTransition`, and terms validation.
- [ ] Build `src/middleware.ts` for Edge RBAC route protection.
- [ ] Create `/pending-approval` and `/forgot-password` pages.

### Week 2: Merchant Portal Core & Ledger System
- [ ] Build the Merchant Sidebar and Header layout shell.
- [ ] Implement the **Wallet Overview** (`/wallet`) showing real-time balance.
- [ ] Build the **Add Funds** flow (submitting `FundRequest` with UTR).
- [ ] Implement the immutable **Transaction Ledger** table (`/transactions`) with filtering.

### Week 3: Disbursal Engine & Fraud Prevention
- [ ] Build the **Single Payout Form** with instant bank account & IFSC validation.
- [ ] Build the **Bulk Payout CSV** uploader with live streaming parsing.
- [ ] Implement the **Payout State Machine** (`PENDING` ➔ `PROCESSING` ➔ `SUCCESS`).
- [ ] Integrate **Global & Merchant Blacklist** checks before initiating payouts.

### Week 4: Dashboard Analytics & Direct Support Chat
- [ ] Implement **Analytics Cards** (Total Volume, Today's Payouts, Success Ratios).
- [ ] Build **Interactive Charts** (Hourly distribution, transaction trends).
- [ ] Build the **Support Chat Module** (`/support`) for real-time ticket communication between Merchants and Admins.

### Week 5: Admin Command Center
- [ ] Build the **Fund Request Approval Queue** (verifying UTR and executing atomic wallet credits).
- [ ] Build the **Merchant Moderation Panel** (approving KYC, toggling suspensions).
- [ ] Implement **Global Blacklist Management** (banning suspicious UPI/Bank accounts).
- [ ] Build the **Platform Tax & Fee Configurator** (dynamic GST and payout fees).

### Week 6: Developer Gateway API & Final Polish
- [ ] Build the **Developer Portal** (API Key generation, docs, copyable code snippets).
- [ ] Expose `POST /api/v1/payouts` with mandatory `Idempotency-Key` headers.
- [ ] Build CSV & PDF Report generation for accounting reconciliation.
- [ ] Production deployment & demo testing.
