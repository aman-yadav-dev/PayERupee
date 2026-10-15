import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/v1/admin/settings/route";
import { Prisma } from "@prisma/client";

vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    }
  }
}));
import { auth } from "@/modules/auth/infrastructure/auth";

describe("Admin System Settings API", () => {
  const adminUserId = "test-admin-settings-user";
  const merchantUserId = "test-merchant-settings-user";

  beforeEach(async () => {
    await db.user.upsert({
      where: { id: adminUserId },
      update: { role: "ADMIN" },
      create: {
        id: adminUserId,
        email: "admin-settings@payerupee.test",
        name: "Test Admin Settings",
        role: "ADMIN",
        emailVerified: true
      }
    });

    await db.user.upsert({
      where: { id: merchantUserId },
      update: { role: "MERCHANT" },
      create: {
        id: merchantUserId,
        email: "merchant-settings@payerupee.test",
        name: "Test Merchant Settings",
        role: "MERCHANT",
        emailVerified: true
      }
    });
    
    await db.systemSetting.upsert({
      where: { id: "GLOBAL_SETTINGS" },
      update: {
        minAddFundsAmount: 100.0000,
        minWithdrawAmount: 500.0000,
        upiPayoutFee: 2.50
      },
      create: {
        id: "GLOBAL_SETTINGS",
        minAddFundsAmount: 100.0000,
        minWithdrawAmount: 500.0000,
        upiPayoutFee: 2.50
      }
    });
  });

  const mockSession = (userId: string | null) => {
    if (!userId) {
      (auth.api.getSession as any).mockResolvedValue(null);
    } else {
      (auth.api.getSession as any).mockResolvedValue({
        session: { id: "test-session", userId },
        user: { id: userId }
      });
    }
  };

  const createRequest = (method: string, body?: any) => {
    return new NextRequest("http://localhost/api/v1/admin/settings", {
      method,
      body: body ? JSON.stringify(body) : undefined
    });
  };

  it("1. Authorized admin can read minimum settings", async () => {
    mockSession(adminUserId);
    const res = await GET(createRequest("GET"));
    expect(res.status).toBe(200);
    const data = await res.json();
    // Use Number() just for assertion shorthand, API returned strings
    expect(Number(data.minAddFundsAmount)).toBe(100);
    expect(Number(data.minWithdrawAmount)).toBe(500);
  });

  it("2. Authorized admin can update both minimum settings", async () => {
    mockSession(adminUserId);
    const res = await PATCH(createRequest("PATCH", {
      minAddFundsAmount: "150.50",
      minWithdrawAmount: "600.00"
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.minAddFundsAmount).toBe("150.5");
    
    const saved = await db.systemSetting.findUnique({ where: { id: "GLOBAL_SETTINGS" } });
    expect(saved!.minAddFundsAmount.toString()).toBe("150.5");
  });

  it("3. Unauthorized merchant cannot update them", async () => {
    mockSession(merchantUserId);
    const res = await PATCH(createRequest("PATCH", { minAddFundsAmount: "200" }));
    expect(res.status).toBe(403);
  });

  it("4. Unauthenticated request is rejected", async () => {
    mockSession(null);
    const res = await GET(createRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("5. Negative amount rejected", async () => {
    mockSession(adminUserId);
    const res = await PATCH(createRequest("PATCH", {
      minAddFundsAmount: "-10",
      minWithdrawAmount: "500"
    }));
    expect(res.status).toBe(400);
  });

  it("6. Zero rejected", async () => {
    mockSession(adminUserId);
    const res = await PATCH(createRequest("PATCH", {
      minAddFundsAmount: "0",
    }));
    expect(res.status).toBe(400);

    const res2 = await PATCH(createRequest("PATCH", {
      minAddFundsAmount: "0.0000",
    }));
    expect(res2.status).toBe(400);
  });

  it("7. Malformed amount rejected", async () => {
    mockSession(adminUserId);
    const res1 = await PATCH(createRequest("PATCH", { minAddFundsAmount: "abc" }));
    expect(res1.status).toBe(400);
    
    const res2 = await PATCH(createRequest("PATCH", { minAddFundsAmount: "1e5" })); // Exponent
    expect(res2.status).toBe(400);

    const res3 = await PATCH(createRequest("PATCH", { minAddFundsAmount: "NaN" })); 
    expect(res3.status).toBe(400);

    const res4 = await PATCH(createRequest("PATCH", { minAddFundsAmount: "Infinity" })); 
    expect(res4.status).toBe(400);
  });

  it("8. >4 decimal places rejected", async () => {
    mockSession(adminUserId);
    const res = await PATCH(createRequest("PATCH", { minAddFundsAmount: "100.12345" }));
    expect(res.status).toBe(400);
  });

  it("9. Decimal(18,4)-overflow value rejected", async () => {
    mockSession(adminUserId);
    // 15 digits before decimal should fail (max 14)
    const res = await PATCH(createRequest("PATCH", { minAddFundsAmount: "100000000000000.00" }));
    expect(res.status).toBe(400);
  });

  it("10. Valid 4-decimal value preserved exactly", async () => {
    mockSession(adminUserId);
    const res = await PATCH(createRequest("PATCH", {
      minAddFundsAmount: "123.4567"
    }));
    expect(res.status).toBe(200);
    const saved = await db.systemSetting.findUnique({ where: { id: "GLOBAL_SETTINGS" } });
    expect(saved!.minAddFundsAmount.toString()).toBe("123.4567");
  });

  it("11. PATCH only minAddFundsAmount preserves minWithdrawAmount", async () => {
    mockSession(adminUserId);
    const res = await PATCH(createRequest("PATCH", {
      minAddFundsAmount: "250.00"
    }));
    expect(res.status).toBe(200);
    const saved = await db.systemSetting.findUnique({ where: { id: "GLOBAL_SETTINGS" } });
    expect(saved!.minAddFundsAmount.toString()).toBe("250");
    expect(saved!.minWithdrawAmount.toString()).toBe("500"); // Original preserved
  });

  it("12. PATCH only minWithdrawAmount preserves minAddFundsAmount", async () => {
    mockSession(adminUserId);
    const res = await PATCH(createRequest("PATCH", {
      minWithdrawAmount: "750.00"
    }));
    expect(res.status).toBe(200);
    const saved = await db.systemSetting.findUnique({ where: { id: "GLOBAL_SETTINGS" } });
    expect(saved!.minAddFundsAmount.toString()).toBe("100"); // Original preserved
    expect(saved!.minWithdrawAmount.toString()).toBe("750");
  });

  it("13. Existing unrelated SystemSetting fields are preserved", async () => {
    mockSession(adminUserId);
    await PATCH(createRequest("PATCH", {
      minAddFundsAmount: "150.50",
    }));
    const saved = await db.systemSetting.findUnique({ where: { id: "GLOBAL_SETTINGS" } });
    expect(Number(saved!.upiPayoutFee)).toBe(2.50);
  });

  it("14. GET does not create settings but throws 500 if missing", async () => {
    mockSession(adminUserId);
    // Delete settings to test the side effect behavior
    vi.spyOn(db.systemSetting, "findUnique").mockResolvedValueOnce(null);
    const res = await GET(createRequest("GET"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("System settings not initialized");
  });

  it("15. PATCH records audit log with previous and updated amounts", async () => {
    mockSession(adminUserId);
    const res = await PATCH(createRequest("PATCH", {
      minAddFundsAmount: "175.0000",
      minWithdrawAmount: "650.0000"
    }));
    expect(res.status).toBe(200);

    const log = await db.auditLog.findFirst({
      where: {
        entityType: "SYSTEM",
        entityId: "GLOBAL_SETTINGS",
        action: "UPDATE",
      },
      orderBy: { createdAt: "desc" }
    });

    expect(log).toBeDefined();
    expect(log!.actorId).toBe(adminUserId);
    const meta = log!.metadata as any;
    expect(meta.previous.minAddFundsAmount).toBe("100");
    expect(meta.updated.minAddFundsAmount).toBe("175");
    expect(meta.updated.minWithdrawAmount).toBe("650");
  });
});

