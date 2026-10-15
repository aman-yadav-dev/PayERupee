process.env.DISABLE_DEV_SCHEDULER = "true";
import "dotenv/config";
import { db } from "@/infrastructure/database/db";

async function main() {
  const rawUrl = process.env.DATABASE_URL || "postgresql://localhost:5432/payerupee_dev";
  const url = new URL(rawUrl);
  
  console.log("=== Database Target ===");
  console.log("Host:", url.hostname);
  console.log("Port:", url.port || "5432");
  console.log("Database Name:", url.pathname.replace("/", ""));
  console.log("Protocol:", url.protocol);
  console.log("SSL:", url.searchParams.get("sslmode") || "disabled/default");

  const [users, merchants, kycApps, withdrawals, payouts, admins, superAdmins] = await Promise.all([
    db.user.count(),
    db.merchantProfile.count(),
    db.kycApplication.count(),
    db.withdrawal.count(),
    db.payout.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { role: "SUPER_ADMIN" } }),
  ]);

  console.log("\n=== Current Record Counts ===");
  console.log("Total Users:", users);
  console.log("Total Merchants:", merchants);
  console.log("Total KYC Applications:", kycApps);
  console.log("Total Withdrawals:", withdrawals);
  console.log("Total Payouts:", payouts);
  console.log("Admin Users:", admins);
  console.log("Super Admin Users:", superAdmins);

  // Check specific Super Admin amanyadav15171@gmail.com
  const designatedSuperAdmin = await db.user.findUnique({
    where: { email: "amanyadav15171@gmail.com" },
    select: { id: true, email: true, role: true, emailVerified: true, createdAt: true },
  });
  console.log("\n=== Designated Super Admin Verification ===");
  console.log("Found:", designatedSuperAdmin ? "YES" : "NO");
  if (designatedSuperAdmin) {
    console.log("ID:", designatedSuperAdmin.id);
    console.log("Email:", designatedSuperAdmin.email);
    console.log("Role:", designatedSuperAdmin.role);
    console.log("Email Verified:", designatedSuperAdmin.emailVerified);
    console.log("Created At:", designatedSuperAdmin.createdAt.toISOString());
  }

  // Check recent audit log entries
  const recentAudit = await db.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, entityType: true, actorType: true, createdAt: true },
  });
  console.log("\n=== Recent Audit Logs (Last 5) ===");
  console.log(JSON.stringify(recentAudit, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
