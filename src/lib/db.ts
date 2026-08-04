import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Instantiate the Postgres connection pool
const connectionString = process.env.DATABASE_URL;

const prismaClientSingleton = () => {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  // Pass the adapter to the Prisma Client constructor
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const db = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = db;
