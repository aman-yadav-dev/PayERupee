process.env.DISABLE_DEV_SCHEDULER = "true";
import "dotenv/config";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";
import { UserRole } from "@prisma/client";

async function main() {
  const email = "qa.admin@payerupee.in";
  const password = "AdminPassword123!";
  const name = "QA Ordinary Admin";

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { role: UserRole.ADMIN, emailVerified: true },
    });
    console.log(`Updated existing user ${email} to ADMIN role.`);
  } else {
    const created = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    if (created?.user?.id) {
      await db.user.update({
        where: { id: created.user.id },
        data: { role: UserRole.ADMIN, emailVerified: true },
      });
      console.log(`Successfully provisioned QA ADMIN account: ${email}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to setup QA admin:", err);
  process.exit(1);
});
