"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

import { loginSchema, type LoginInput } from "@/schemas/auth";
import { successResponse, errorResponse } from "@/lib/responses";
import { type ApiResponse } from "@/types/api";

// import { logger } from "@/lib/logger"; // TODO: Phase 3

export async function loginAction(
  data: LoginInput
): Promise<ApiResponse> {
  try {
    // 1. Validate request
    const parsed = loginSchema.safeParse(data);

    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        parsed.error.flatten().fieldErrors
      );
    }

    const { email, password } = parsed.data;

    // 2. Authenticate user
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: await headers(),
    });

    return successResponse(null, "Login successful");
  } catch (error: unknown) {
    // logger.error(...)

    const message =
      error instanceof Error ? error.message.toLowerCase() : "";

    // Never reveal whether email or password was incorrect
    if (
      message.includes("invalid") ||
      message.includes("credential") ||
      message.includes("password") ||
      message.includes("email") ||
      message.includes("user")
    ) {
      return errorResponse("Invalid email or password");
    }

    return errorResponse("An internal server error occurred.");
  }
}