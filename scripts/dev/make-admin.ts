import { db } from "../../src/infrastructure/database/db";

async function main() {
  if (process.env.NODE_ENV !== "development") {
    console.error("ERROR: This script can only be run in development mode.");
    process.exit(1);
  }

  const email = process.argv[2];
  if (!email) {
    console.error("ERROR: Please provide an email address.");
    console.error("Usage: npx tsx scripts/dev/make-admin.ts <email>");
    process.exit(1);
  }

  const user = await db.user.findUnique({ where: { email } });
  
  if (!user) {
    console.error(`ERROR: User with email ${email} not found.`);
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (Current role: ${user.role})`);
  
  await db.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" }
  });
  
  console.log(`User ${user.email} successfully promoted to ADMIN.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
