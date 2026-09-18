"use server";

import { headers } from "next/headers";
import { auth } from "@/modules/auth/infrastructure/auth";
import { forgotPasswordSchema } from "@/modules/auth/schemas/auth.schema";
import { errorResponse, successResponse } from "@/shared/utils/responses";
import type { ApiResponse } from "@/shared/types/api";

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

    // Better Auth handles enumeration protection natively inside requestPasswordReset.
    // It will return success whether the email exists or not.
    // @ts-ignore: Better Auth typings might map this to forgetPassword or requestPasswordReset
    const apiCall = auth.api.forgetPassword || auth.api.requestPasswordReset;
    await apiCall({
      body: {
        email,
        redirectTo: "/reset-password",
      },
      headers: await headers(),
    });

    // Return generic success message to prevent enumeration
    return successResponse(
      { email },
      "If an account exists with this email, recovery instructions have been sent."
    );
  } catch (error: any) {
    console.error("❌ Forgot Password Error:", error);
    return errorResponse("Failed to process password reset request. Please try again later.");
  }
}
