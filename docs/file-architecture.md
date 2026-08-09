# File Architecture

```text
PayERupee/
├── docs/                 # Source of truth architectural documentation
├── memory/               # AI/Developer contextual memory logs
├── prisma/               # Schema, migrations, seed scripts
├── src/
│   ├── actions/          # Zod-validated Server Actions (UI to Service bridge)
│   ├── app/              # Next.js App Router (UI & Route Handlers)
│   ├── components/       # Reusable React components (shadcn/ui)
│   ├── config/           # Environment and global constants
│   ├── lib/              # Shared utilities (db.ts, auth.ts)
│   ├── schemas/          # Zod schemas (Single source of truth for validation)
│   ├── services/         # Domain-Driven services (The Core Business Logic)
│   └── types/            # TypeScript Interfaces and Generics
```\n