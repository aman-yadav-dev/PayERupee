import 'dotenv/config';
import { afterAll } from 'vitest';

process.env.DATABASE_URL = process.env.DIRECT_URL;

// Ensure we end the pool globally after all tests in the current thread finish
afterAll(async () => {
  const { pool, db } = await import('@/lib/db');
  await db.$disconnect();
  await pool.end();
});
