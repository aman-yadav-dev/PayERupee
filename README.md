# PayERupee ⚡

> **Next-Generation B2B Payout Gateway & Financial Disbursal Platform**

PayERupee is a developer-first, fullstack fintech application designed for automated mass payouts, instant cashback distributions, and multi-tenant ledger management. Built on Next.js 15, PostgreSQL, Prisma 7, and Tailwind CSS.

---

## 🚀 Key Features

* **Dual Portal Architecture:** Isolated, dedicated dashboards for **Merchants** and **Super Admins**.
* **Immutable Double-Entry Ledger:** Balances are strictly calculated from append-only transaction logs.
* **Two-Tier Idempotency:** Prevents double-debiting on network retries via `Idempotency-Key` headers.
* **Developer Gateway API:** Clean, versioned REST endpoints (`/api/v1/payouts`, `/api/v1/balance`) for server-to-server automation.
* **Fraud Prevention & Blacklist:** Global and merchant-level banning of fraudulent UPI IDs and bank accounts.
* **Direct Support Chat:** In-app ticket messaging between merchants and administrators.
* **Optimistic Locking:** Concurrency-safe wallet updates preventing race conditions.

---

## 🛠️ Tech Stack

* **Frontend:** Next.js 15 (App Router, React 19), Tailwind CSS v4, shadcn/ui, Framer Motion, Lucide Icons, Sonner.
* **Backend:** Next.js Server Actions & Route Handlers, Better Auth, Zod.
* **Database & ORM:** PostgreSQL, Prisma ORM 7 (`@prisma/adapter-pg`).
* **Caching & Rate Limiting:** Redis (Upstash / Self-Hosted).

---

## 🏁 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/payerupee.git
cd payerupee
npm install
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Fill in your PostgreSQL and Better Auth connection strings.

### 3. Initialize Database
```bash
npx prisma db push
npx prisma generate
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📚 Documentation

Detailed specifications and architectural guides are available in the [`docs/`](./docs) folder:
* [Architecture Blueprint](./docs/architecture.md)
* [REST API Specification](./docs/api.md)
* [Database Design & ERD](./docs/database.md)
* [Deployment Guide](./docs/deployment.md)
* [6-Week Roadmap](./docs/roadmap.md)
* [Release Notes](./docs/release-notes.md)

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
