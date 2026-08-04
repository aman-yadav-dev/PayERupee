"use server";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import { registerSchema, type RegisterInput } from "@/schemas/auth";
import { successResponse, errorResponse } from "@/lib/responses";
import { type ApiResponse } from "@/types/api";

// import { logger } from "@/lib/logger"; // TODO: Phase 3

export async function registerMerchantAction(
  data: RegisterInput,
): Promise<ApiResponse> {
  let createdUserId: string | null = null;

  try {
    // 1. Validate Request
    const parsed = registerSchema.safeParse(data);

    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        parsed.error.flatten().fieldErrors,
      );
    }

    const { email, password, name, businessName, address, phone } = parsed.data;

    // 2. Create Authentication Identity
    const authResponse = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
      headers: await headers(),
    });

    // 3. Extract User ID
    if (authResponse?.user?.id) {
      createdUserId = authResponse.user.id;
    } else {
      // Defensive fallback
      const existingUser = await db.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

      if (!existingUser) {
        throw new Error("Unable to verify created user.");
      }

      createdUserId = existingUser.id;
    }

    const userId = createdUserId!;

    // 4. Initialize Merchant Data
    await db.$transaction([
      db.user.update({
        where: {
          id: userId,
        },
        data: {
          businessName,
          address,
          phone,
          role: "MERCHANT",
          status: "PENDING",
        },
      }),

      db.wallet.create({
        data: {
          merchantId: userId,
        },
      }),

      // Phase 3
      // db.auditLog.create({...})
    ]);

    return successResponse(
      null,
      "Registration successful. Welcome to PayERupee.",
    );
  } catch (error: unknown) {
    // 5. Compensation Strategy
    if (createdUserId) {
      try {
        await db.user.update({
          where: {
            id: createdUserId,
          },
          data: {
            status: "SUSPENDED",
          },
        });

        // logger.error(...)
      } catch (cleanupError) {
        // logger.fatal(...)
      }
    }

    // 6. Prisma Unique Constraint
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse(
        "An account with this email or phone number already exists.",
      );
    }

    // 7. Better Auth / Generic Errors
    const message =
      error instanceof Error
        ? error.message
        : "An internal server error occurred.";

    return errorResponse(message);
  }
}
