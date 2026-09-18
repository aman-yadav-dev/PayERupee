"use server";

import { auth } from "@/modules/auth/infrastructure/auth";
import { resetPasswordSchema, ResetPasswordInput } from "@/modules/auth/schemas/auth.schema";
import { headers } from "next/headers";

export type ActionResponse =
  | { success: true; message: string }
  | { success: false; message: string; errors?: Record<string, string[]> };

export async function resetPasswordAction(input: ResetPasswordInput): Promise<ActionResponse> {
  // 1. Strict Server-Side Validation
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please check the form for errors.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // 2. Invoke Better Auth passing the extracted token and mapped newPassword
    const reqHeaders = await headers();

    const res = await auth.api.resetPassword({
      body: {
        newPassword: parsed.data.password,
        token: parsed.data.token,
      },
      headers: reqHeaders,
    });

    if (res.status) {
      return { success: true, message: "Password updated successfully" };
    }

    return { success: false, message: "An unexpected error occurred." };
  } catch (error: any) {
    // 3. Graceful, sanitized error handling
    if (error?.body?.code === "INVALID_TOKEN") {
      return { success: false, message: "This password reset link is invalid or has expired." };
    }
    return { success: false, message: "An unexpected error occurred." };
  }
}
