# API Architecture

## Canonical API Response Format
All internal Server Actions and external APIs strictly match `src/types/api.ts` and `src/lib/responses.ts`:

```ts
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T | null;
  error: string | null;
  errors?: Record<string, string[]> | null;
}
```

- `error`: Contains a broad system error message.
- `errors`: Contains granular field-level Zod validation errors.\n