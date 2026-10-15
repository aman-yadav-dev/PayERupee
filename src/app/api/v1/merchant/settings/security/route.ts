import { NextRequest, NextResponse } from "next/server";
import { db } from "@/infrastructure/database/db";
import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";
import { z } from "zod";
import * as ipaddr from "ipaddr.js";
import { SecurityEventType } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { merchantProfileId } = await requireMerchantContext(req);

    let settings = await db.merchantSecuritySettings.findUnique({
      where: { merchantProfileId }
    });

    if (!settings) {
      settings = await db.merchantSecuritySettings.create({
        data: { merchantProfileId }
      });
    }

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  ipWhitelistEnabled: z.boolean().optional(),
  allowedIps: z.array(z.string()).optional(),
  maxApiPayoutEnabled: z.boolean().optional(),
  maxApiPayoutAmount: z.coerce.number().min(0).optional(),
  suspiciousAlertsEnabled: z.boolean().optional(),
  suspiciousThreshold: z.coerce.number().min(1).max(1000).optional(),
  suspiciousWindowSeconds: z.coerce.number().min(10).max(3600).optional(),
  suspiciousIpEnabled: z.boolean().optional(),
  suspiciousUpiEnabled: z.boolean().optional(),
  suspiciousBankAccountEnabled: z.boolean().optional(),
  suspiciousEmailEnabled: z.boolean().optional(),
  suspiciousAlertCooldown: z.coerce.number().min(60).max(86400).optional(),
  loginNotificationsEnabled: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  try {
    const { merchantProfileId } = await requireMerchantContext(req);
    const body = await req.json();
    const data = updateSchema.parse(body);

    // Validate IPs
    if (data.allowedIps) {
      const validIps: string[] = [];
      for (const ip of data.allowedIps) {
        try {
          if (ip.includes("/")) {
            ipaddr.parseCIDR(ip);
          } else {
            ipaddr.parse(ip);
          }
          validIps.push(ip);
        } catch {
          return NextResponse.json({ success: false, error: `Invalid IP address or CIDR: ${ip}` }, { status: 400 });
        }
      }
      data.allowedIps = validIps;
    }

    const settings = await db.merchantSecuritySettings.upsert({
      where: { merchantProfileId },
      create: { merchantProfileId, ...data },
      update: { ...data }
    });

    // Audit log
    await db.securityEvent.create({
      data: {
        merchantProfileId,
        eventType: "SECURITY_SETTING_CHANGED",
        severity: "LOW",
        description: "Merchant updated security settings.",
        metadata: data as any
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.name === "ZodError" || error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid data provided for settings." }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
