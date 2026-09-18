import { cookies } from "next/headers";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/infrastructure/database/db";
import { env } from "@/config/env";
import { EMAIL_VERIFICATION_EXPIRATION_SECONDS } from "@/infrastructure/notifications/mailer";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/v1/auth",

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 3600, // 1 hour
    sendResetPassword: async ({ user, url, token }) => {
      const { sendPasswordResetEmail } = await import("@/infrastructure/notifications/mailer");

      const resetUrl = new URL(url);
      // The callbackURL is where Better Auth will redirect the user after token validation
      resetUrl.searchParams.set("callbackURL", `${resetUrl.origin}/reset-password`);

      await sendPasswordResetEmail({
        user: { id: user.id, email: user.email!, name: user.name },
        url: resetUrl.toString(),
        token,
      });
    },
    revokeSessionsOnPasswordReset: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: EMAIL_VERIFICATION_EXPIRATION_SECONDS,
    sendVerificationEmail: async ({ user, url, token }) => {
      const { sendVerificationEmail } = await import("@/infrastructure/notifications/mailer");
      const { setSystemLease } = await import("@/modules/system/domain/lease.service");

      const verifyUrl = new URL(url);
      verifyUrl.searchParams.set("callbackURL", `${verifyUrl.origin}/verify-result?success=true`);

      await sendVerificationEmail({ user: { id: user.id, email: user.email!, name: user.name }, url: verifyUrl.toString(), token });

      // ONLY AFTER successful mailer completion, establish the cooldown lease
      await setSystemLease(`email_verification_cooldown_${user.id}`, user.id, 30);
    },
    afterEmailVerification: async () => {
      const cookieStore = await cookies();
      cookieStore.set("payERupee_verification_fresh", "1", {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/verify-result",
        maxAge: 15,
      });
    },
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
