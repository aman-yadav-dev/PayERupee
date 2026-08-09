# File Architecture

```text
PayERupee/
├── docs/                 # Source of truth architecture
├── memory/               # AI/Developer contextual state
├── prisma/               # Schema and migrations
├── src/
│   ├── actions/          # Zod-validated Server Actions (UI to Service bridge)
│   ├── app/              # Next.js App Router (UI & Route Handlers)
│   ├── components/       # Reusable React components
│   ├── schemas/          # Zod schemas (Validation)
│   ├── services/         # Domain-Driven services
│   └── types/            # TypeScript Interfaces
```\n