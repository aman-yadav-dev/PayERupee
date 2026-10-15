import "dotenv/config";
process.env.DISABLE_DEV_SCHEDULER = "true";

import { validatePricingConfiguration } from "../src/modules/payout/application/pricing.validator";
import { db } from "../src/infrastructure/database/db";

async function validatePartialUniqueIndexes() {
  const REQUIRED_INDEXES = [
    { index: "merchant_bans_active_unique_idx", table: "merchant_bans" },
    { index: "global_bans_active_unique_idx", table: "global_bans" },
    { index: "global_ban_requests_pending_unique_idx", table: "global_ban_requests" },
  ];

  try {
    const existingTables = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE tablename IN ('merchant_bans', 'global_bans', 'global_ban_requests')
    `;

    const tableNames = new Set(existingTables.map((t) => t.tablename));
    if (tableNames.size === 0) {
      console.log("Deployment Verification: Ban tables not present. Skipping partial unique indexes check.");
      return;
    }

    const existingIndexes = await db.$queryRaw<{ indexname: string; tablename: string }[]>`
      SELECT indexname, tablename FROM pg_indexes
      WHERE indexname IN (
        'merchant_bans_active_unique_idx',
        'global_bans_active_unique_idx',
        'global_ban_requests_pending_unique_idx'
      )
    `;

    const indexNames = new Set(existingIndexes.map((i) => i.indexname));
    const missingIndexes = REQUIRED_INDEXES
      .filter((req) => tableNames.has(req.table) && !indexNames.has(req.index))
      .map((req) => req.index);

    if (missingIndexes.length > 0) {
      throw new Error(
        `Missing partial unique index(es): ${missingIndexes.join(", ")}. ` +
        `Ban tables exist but partial unique indexes were not found in pg_indexes. ` +
        `'npx prisma migrate deploy' must be executed to ensure partial unique indexes are created and preserved!`
      );
    }

    console.log("Deployment Verification: All partial unique indexes for ban tables are present and verified.");
  } catch (err) {
    console.error("Deployment Verification: Partial unique index validation error:", err);
    throw err;
  }
}

async function main() {
  try {
    await validatePricingConfiguration();
    console.log("Deployment Verification: Pricing configuration is strictly valid.");
    await validatePartialUniqueIndexes();
    process.exit(0);
  } catch (err) {
    console.error("Deployment Verification FAILED:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();

