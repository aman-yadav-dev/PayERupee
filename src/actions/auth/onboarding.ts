"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { onboardingSchema } from "@/schemas/auth";
import { errorResponse, successResponse } from "@/lib/responses";
import { UserRole, UserStatus, Currency } from "@prisma/client";
import type { ApiResponse } from "@/types/api";

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

    const { businessName, phone, address } = parseResult.data;

    // 3. Check for existing phone collision
    const existingPhone = await db.user.findFirst({
      where: {
        phone,
        id: { not: userId },
      },
    });

    if (existingPhone) {
      return errorResponse("Phone number is already registered to another account", {
        phone: ["This phone number is already registered"],
      });
    }

    // 4. Update user profile & initialize merchant wallet in transaction
    await db.$transaction(async (tx) => {
      // Update User profile
      await tx.user.update({
        where: { id: userId },
        data: {
          businessName,
          phone,
          address,
          role: UserRole.MERCHANT,
          status: UserStatus.PENDING,
        },
      });

      // Check or create wallet
      const existingWallet = await tx.wallet.findUnique({
        where: { merchantId: userId },
      });

      if (!existingWallet) {
        await tx.wallet.create({
          data: {
            merchantId: userId,
            balance: 0.0,
            currency: Currency.INR,
          },
        });
      }
    });

    return successResponse(
      { userId },
      "Merchant profile updated successfully. Your account is now under review."
    );
  } catch (error: any) {
    console.error("❌ Merchant Onboarding Action Error:", error);
    return errorResponse("Failed to save merchant profile. Please try again.");
  }
}
