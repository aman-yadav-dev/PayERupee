import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/infrastructure/database/db";
import { env } from "@/config/env";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/v1/auth",

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },

  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },

  secret: env.BETTER_AUTH_SECRET,
  plugins: [nextCookies()],

  databaseHooks: {
    session: {
      create: {
        async before(session) {
          const profile = await db.merchantProfile.findUnique({
            where: { userId: session.userId },
            select: { accountStatus: true },
          });

          if (profile) {
            if (profile.accountStatus === "SUSPENDED" || profile.accountStatus === "DELETED") {
              throw APIError.from("UNAUTHORIZED", { code: "UNAUTHORIZED", message: "Account is suspended" });
            }
          }
          
          return { data: session };
        },
      },
    },
  },
});
