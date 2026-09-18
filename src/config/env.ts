import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  DIRECT_URL: z.string().url("DIRECT_URL must be a valid URL"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Phase 5 Provider-Neutral Configuration Boundary
  PROVIDER_NAME: z.string().optional(),
  PROVIDER_API_KEY: z.string().optional(),
  PROVIDER_API_SECRET: z.string().optional(),
  PROVIDER_WEBHOOK_SECRET: z.string().optional(),

  // Phase 6 Cashfree Configuration
  CASHFREE_CLIENT_ID: z.string().optional(),
  CASHFREE_CLIENT_SECRET: z.string().optional(),
  CASHFREE_WEBHOOK_SECRET: z.string().optional(),
  CASHFREE_ENVIRONMENT: z.enum(["TEST", "PRODUCTION"]).default("TEST"),

  // PayMyQR Configuration
  PAYMYQR_BASE_URL: z.string().url("PAYMYQR_BASE_URL must be a valid URL").optional(),
  PAYMYQR_VENDOR_ID: z.string().optional(),
  PAYMYQR_SECURITY_TOKEN: z.string().optional(),

  // Background Workers
  CRON_SECRET: z.string().optional(),

  // Email Configuration (SMTP)
  SMTP_ENABLED: z.enum(["true", "false", "1", "0"]).transform((val) => val === "true" || val === "1").optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid environment variables. Check your .env file.");
}

export const env = parsedEnv.data;
