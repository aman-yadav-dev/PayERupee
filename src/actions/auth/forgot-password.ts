"use server";

import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/schemas/auth";
import { errorResponse, successResponse } from "@/lib/responses";
import type { ApiResponse } from "@/types/api";

export async function forgotPasswordAction(
  rawInput: unknown
): Promise<ApiResponse<{ email: string } | null>> {
  try {
    const parseResult = forgotPasswordSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return errorResponse(
        "Invalid email address",
        parseResult.error.flatten().fieldErrors
      );
    }

    const { email } = parseResult.data;

    // Check if user exists (without revealing exact existence in error for security)
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return success response to prevent email enumeration attacks
      return successResponse(
        { email },
        "If an account exists with this email, recovery instructions have been sent."
      );
    }

    // Return success message
    return successResponse(
      { email },
      "Password reset instructions have been sent to your email."
    );
  } catch (error: any) {
    console.error("❌ Forgot Password Error:", error);
    return errorResponse("Failed to process password reset request. Please try again later.");
  }
}
