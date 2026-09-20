"use server";

import { headers } from "next/headers";
import { auth } from "@/modules/auth/infrastructure/auth";
import { onboardingSchema } from "@/modules/auth/schemas/auth.schema";
import { errorResponse, successResponse } from "@/shared/utils/responses";
import type { ApiResponse } from "@/shared/types/api";

import { onboardMerchant, MerchantExistsError } from "@/modules/merchant/domain/merchant.service";
import { Prisma } from "@prisma/client";

export async function completeMerchantOnboardingAction(
  rawInput: unknown
): Promise<ApiResponse<{ userId: string } | null>> {
  try {
    // 1. Authenticate user from session headers
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return errorResponse("Authentication required. Please sign in first.");
    }

    const userId = session.user.id;

    // 2. Validate input schema
    const parseResult = onboardingSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return errorResponse(
        "Invalid onboarding information",
        parseResult.error.flatten().fieldErrors
      );
    }

    const { phone } = parseResult.data;

    // 3. Execute atomic merchant onboarding
    await onboardMerchant({
      userId,
      phone,
    });

    return successResponse(
      { userId },
      "Merchant profile created successfully. Your account is now under review."
    );
  } catch (error: any) {
    console.error("❌ Merchant Onboarding Action Error:", error);
    
    if (error instanceof MerchantExistsError) {
      return errorResponse("Merchant profile already exists for this account.");
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse("Phone number is already registered to another account", {
        phone: ["This phone number is already registered"],
      });
    }

    return errorResponse("Failed to save merchant profile. Please try again.");
  }
}
