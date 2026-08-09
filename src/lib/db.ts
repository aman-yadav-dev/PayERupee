import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
  var pgPoolGlobal: undefined | Pool;
}

const connectionString = process.env.DATABASE_URL;

export const pool = globalThis.pgPoolGlobal ?? new Pool({ connectionString });

const prismaClientSingleton = () => {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

export const db = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = db;
  globalThis.pgPoolGlobal = pool;
}
