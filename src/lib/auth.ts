import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";
import { env } from "@/config/env";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },

  secret: env.BETTER_AUTH_SECRET,

  baseURL: `${env.BETTER_AUTH_URL}/api/v1/auth`,
});
