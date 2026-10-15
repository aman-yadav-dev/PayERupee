process.env.DISABLE_DEV_SCHEDULER = "true";
import "dotenv/config";
import { db } from "@/infrastructure/database/db";

async function main() {
  const settings = await db.systemSetting.findUnique({
    where: { id: "GLOBAL_SETTINGS" },
  });
  console.log("=== CURRENT GLOBAL SETTINGS ===");
  console.log("minAddFundsAmount:", settings?.minAddFundsAmount.toString());
  console.log("minWithdrawAmount:", settings?.minWithdrawAmount.toString());
  console.log("updatedAt:", settings?.updatedAt.toISOString());

  const settingsAudit = await db.auditLog.findMany({
    where: { entityType: "SYSTEM" },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  console.log("\n=== RECENT SETTINGS AUDIT LOGS ===");
  console.log(JSON.stringify(settingsAudit, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error("Audit check error:", err);
  process.exit(1);
});
