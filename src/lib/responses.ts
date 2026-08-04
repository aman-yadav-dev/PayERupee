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
  return {
    success: false,
    message,
    data: null,
    error: errorDetails ? JSON.stringify(errorDetails) : message,
  };
}
