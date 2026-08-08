import { ApiResponse } from "@/types/api";

export function successResponse<T>(
  data: T,
  message: string = "Success",
): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    error: null,
  };
}

export function errorResponse(
  message: string,
  errorDetails: any = null,
): ApiResponse<null> {
  const isFieldErrors =
    errorDetails && typeof errorDetails === "object" && !Array.isArray(errorDetails);

  return {
    success: false,
    message,
    data: null,
    error: typeof errorDetails === "string" ? errorDetails : message,
    errors: isFieldErrors ? (errorDetails as Record<string, string[]>) : null,
  };
}
