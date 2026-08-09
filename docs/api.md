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

### Error Handling Coexistence
The `error` and `errors` fields are designed to coexist depending on the failure state:
- `error` (string): Represents a general system or business logic error message (e.g., "Insufficient funds" or "Validation failed").
- `errors` (Record): Contains granular field-level validation mapping from Zod (e.g., `{ amount: ["Must be greater than 0"] }`).
When Zod validation fails, `error` contains the high-level summary, while `errors` contains the UI field mapping.\n