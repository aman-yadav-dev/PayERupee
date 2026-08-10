/**
 * Canonical API Response format used across all Server Actions and Route Handlers.
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T | null;
  /** General system error message or summary (e.g., 'Validation failed') */
  error: string | null;
  /** Granular field-level validation errors. May coexist with \`error\` summary. */
  errors?: Record<string, string[]> | null;
}
