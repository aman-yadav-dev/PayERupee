import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// Validates strictly positive decimal, up to 14 digits before decimal, up to 4 decimal places, no exponent notation
const decimalAmountRegex = /^(?!0+(\.0+)?$)(0|[1-9]\d{0,13})(\.\d{1,4})?$/;

const settingsSchema = z.object({
  minAddFundsAmount: z.string()
    .regex(decimalAmountRegex, "Must be a strictly positive decimal string with up to 14 integer digits and 4 decimal places")
    .optional(),
  minWithdrawAmount: z.string()
    .regex(decimalAmountRegex, "Must be a strictly positive decimal string with up to 14 integer digits and 4 decimal places")
    .optional(),
}).refine(data => data.minAddFundsAmount !== undefined || data.minWithdrawAmount !== undefined, {
  message: "At least one setting must be provided for update"
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    
    const settings = await db.systemSetting.findUnique({
      where: { id: "GLOBAL_SETTINGS" }
    });

    if (!settings) {
      return NextResponse.json({ error: "System settings not initialized" }, { status: 500 });
    }

    return NextResponse.json({
      minAddFundsAmount: settings.minAddFundsAmount.toString(),
      minWithdrawAmount: settings.minWithdrawAmount.toString()
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    
    const body = await req.json().catch(() => ({}));
    const parsed = settingsSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
    }

    const settings = await db.systemSetting.findUnique({
      where: { id: "GLOBAL_SETTINGS" }
    });
    
    if (!settings) {
      return NextResponse.json({ error: "System settings not initialized" }, { status: 500 });
    }

    const updateData: Prisma.SystemSettingUpdateInput = {};
    if (parsed.data.minAddFundsAmount !== undefined) {
      updateData.minAddFundsAmount = parsed.data.minAddFundsAmount;
    }
    if (parsed.data.minWithdrawAmount !== undefined) {
      updateData.minWithdrawAmount = parsed.data.minWithdrawAmount;
    }

    const updated = await db.systemSetting.update({
      where: { id: "GLOBAL_SETTINGS" },
      data: updateData
    });

    try {
      const { logAction } = await import("@/modules/audit/domain/audit.service");
      const { AuditActorType, AuditEntity, AuditAction } = await import("@prisma/client");
      await logAction({
        actorType: AuditActorType.ADMIN,
        actorId: session.user.id,
        entityType: AuditEntity.SYSTEM,
        entityId: "GLOBAL_SETTINGS",
        action: AuditAction.UPDATE,
        metadata: {
          previous: {
            minAddFundsAmount: settings.minAddFundsAmount.toString(),
            minWithdrawAmount: settings.minWithdrawAmount.toString(),
          },
          updated: {
            minAddFundsAmount: updated.minAddFundsAmount.toString(),
            minWithdrawAmount: updated.minWithdrawAmount.toString(),
          },
        },
      });
    } catch {
      // Do not block settings update if non-critical audit log write fails
    }

    return NextResponse.json({
      minAddFundsAmount: updated.minAddFundsAmount.toString(),
      minWithdrawAmount: updated.minWithdrawAmount.toString()
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
