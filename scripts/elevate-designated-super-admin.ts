import "dotenv/config";
process.env.DISABLE_DEV_SCHEDULER = "true";
import { db } from "@/infrastructure/database/db";
import { logAction } from "@/modules/audit/domain/audit.service";
import { UserRole, AuditActorType, AuditEntity, AuditAction } from "@prisma/client";

const TARGET_EMAIL = "amanyadav15171@gmail.com";

async function elevateDesignatedSuperAdmin() {
  console.log(`[Elevate] Looking up user with email: ${TARGET_EMAIL}...`);

  const user = await db.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  if (!user) {
    console.error(`[Elevate] FATAL: User with email "${TARGET_EMAIL}" not found in database.`);
    process.exit(1);
  }

  console.log(`[Elevate] User found: id=${user.id}, currentRole=${user.role}, emailVerified=${user.emailVerified}`);

  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: {
      role: UserRole.SUPER_ADMIN,
      emailVerified: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
    },
  });

  console.log(`[Elevate] Role updated to: ${updatedUser.role}, emailVerified=${updatedUser.emailVerified}`);

  await logAction({
    actorType: AuditActorType.SYSTEM,
    entityType: AuditEntity.USER,
    entityId: updatedUser.id,
    action: AuditAction.UPDATE,
    metadata: {
      action: "ELEVATE_SUPER_ADMIN",
      email: TARGET_EMAIL,
    },
  });

  console.log(`[Elevate] Audit log entry recorded successfully.`);
  console.log(`[Elevate] User ${TARGET_EMAIL} is now successfully elevated to SUPER_ADMIN.`);
}

elevateDesignatedSuperAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Elevate] Unhandled error during elevation:", err);
    process.exit(1);
  });
