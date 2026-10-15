import "dotenv/config";
process.env.DISABLE_DEV_SCHEDULER = "true";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";
import { UserRole } from "@prisma/client";

async function bootstrapSuperAdmin() {
  const isProduction = process.env.NODE_ENV === "production";
  const email = process.env.SUPER_ADMIN_EMAIL || "superadmin@payerupee.in";
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (isProduction && (!password || password === "SuperAdmin@PayERupee2026!" || password.length < 12)) {
    console.error("[Bootstrap] FATAL: In production, SUPER_ADMIN_PASSWORD must be explicitly configured with a high-entropy secret (min 12 characters). Fallbacks are strictly forbidden.");
    process.exit(1);
  }

  const effectivePassword = password || "SuperAdmin@PayERupee2026!";
  const name = process.env.SUPER_ADMIN_NAME || "System Super Administrator";

  console.log(`[Bootstrap] Checking super administrator account: ${email}...`);

  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existingUser) {
    if (existingUser.role !== UserRole.SUPER_ADMIN) {
      await db.user.update({
        where: { id: existingUser.id },
        data: { role: UserRole.SUPER_ADMIN, emailVerified: true },
      });
      console.log(`[Bootstrap] Updated existing user ${email} to SUPER_ADMIN role.`);
    } else {
      console.log(`[Bootstrap] User ${email} already exists with SUPER_ADMIN role.`);
    }
    return;
  }

  // Create user via Better Auth so password hashing matches Better Auth exactly
  try {
    const created = await auth.api.signUpEmail({
      body: {
        email,
        password: effectivePassword,
        name,
      },
    });

    if (created?.user?.id) {
      await db.user.update({
        where: { id: created.user.id },
        data: { role: UserRole.SUPER_ADMIN, emailVerified: true },
      });
      console.log(`[Bootstrap] Successfully provisioned new SUPER_ADMIN account: ${email}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Bootstrap] Error provisioning super admin:`, msg);
    process.exit(1);
  }
}

bootstrapSuperAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
