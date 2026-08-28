import 'dotenv/config';
import { beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { Client } from 'pg';

const ROOT_DB_URL = process.env.TEST_ROOT_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const testDbName = `test_db_${randomBytes(4).toString('hex')}`;

// Overwrite connection strings for this worker
const url = new URL(ROOT_DB_URL);
url.pathname = `/${testDbName}`;
const dbUrl = url.toString();

process.env.DATABASE_URL = dbUrl;
process.env.DIRECT_URL = dbUrl;

beforeAll(async () => {
  // 1. Connect to root db and create the isolated database
  const client = new Client({ connectionString: ROOT_DB_URL });
  await client.connect();
  await client.query(`CREATE DATABASE "${testDbName}"`);
  await client.end();

  execSync(`npx prisma db push --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: dbUrl, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "I consent" },
    stdio: 'ignore',
  });

  execSync(`npx prisma db seed`, {
    env: { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: dbUrl },
    stdio: 'inherit',
  });
});

// Ensure we end the pool globally after all tests in the current thread finish
afterAll(async () => {
  // 1. Disconnect the app's Prisma clients and pg pool
  const { pool, db } = await import('@/infrastructure/database/db');
  await db.$disconnect();
  await pool.end();

  // 2. Connect to root db and drop the isolated database
  const client = new Client({ connectionString: ROOT_DB_URL });
  await client.connect();
  // Force disconnect any remaining connections just in case
  await client.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '${testDbName}'
      AND pid <> pg_backend_pid();
  `);
  await client.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
  await client.end();
});
