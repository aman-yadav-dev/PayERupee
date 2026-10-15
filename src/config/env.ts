import { z } from "zod";

export const FORBIDDEN_SECRET_WORDS = [
  "dev",
  "test",
  "example",
  "dummy",
  "sample",
  "placeholder",
  "changeme",
  "secret",
  "password",
  "default",
  "payerupee",
] as const;

function isHexChar(ch: string): boolean {
  return (ch >= "0" && ch <= "9") || (ch >= "a" && ch <= "f");
}

function hasSequentialPattern(str: string): boolean {
  let hexCircAscRun = 1;
  let hexCircDescRun = 1;
  let asciiAscRun = 1;
  let asciiDescRun = 1;

  for (let i = 1; i < str.length; i++) {
    const prevCode = str.charCodeAt(i - 1);
    const currCode = str.charCodeAt(i);

    // ASCII sequential tracking
    if (currCode === prevCode + 1) {
      if (++asciiAscRun >= 8) return true;
    } else {
      asciiAscRun = 1;
    }

    if (currCode === prevCode - 1) {
      if (++asciiDescRun >= 8) return true;
    } else {
      asciiDescRun = 1;
    }

    // Hex sequential tracking (with modulo 16 wraparound)
    if (isHexChar(str[i - 1]) && isHexChar(str[i])) {
      const prevHex = parseInt(str[i - 1], 16);
      const currHex = parseInt(str[i], 16);

      if (currHex === (prevHex + 1) % 16) {
        if (++hexCircAscRun >= 8) return true;
      } else {
        hexCircAscRun = 1;
      }

      if (currHex === (prevHex - 1 + 16) % 16) {
        if (++hexCircDescRun >= 8) return true;
      } else {
        hexCircDescRun = 1;
      }
    } else {
      hexCircAscRun = 1;
      hexCircDescRun = 1;
    }
  }

  return false;
}

export function isProductionSecretSecure(secret: string): boolean {
  if (!secret || typeof secret !== "string") {
    return false;
  }

  const lower = secret.toLowerCase();

  // 1. Reject known placeholders or words (case-insensitive)
  for (const word of FORBIDDEN_SECRET_WORDS) {
    if (lower.includes(word)) {
      return false;
    }
  }

  // 2. Reject all identical characters or low character diversity (< 8 unique characters)
  const uniqueChars = new Set(lower);
  if (uniqueChars.size < 8) {
    return false;
  }

  // 3. Reject repeating block patterns: check if a chunk of length 1 to 16 (or up to half length) repeats to form the string
  const maxBlock = Math.min(32, Math.floor(lower.length / 2));
  for (let blockSize = 1; blockSize <= maxBlock; blockSize++) {
    const block = lower.slice(0, blockSize);
    const repeated = block.repeat(Math.ceil(lower.length / blockSize)).slice(0, lower.length);
    if (repeated === lower) {
      return false;
    }
  }

  // 4. Reject ascending/descending sequential hex and ASCII characters
  if (hasSequentialPattern(lower)) {
    return false;
  }

  return true;
}

export const envSchema = z
  .object({
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

    // Ban User Subsystem Cryptographic Keys
    BAN_HASH_SECRET: z
      .string()
      .min(32, "BAN_HASH_SECRET must be at least 32 characters")
      .optional(),
    BAN_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, "BAN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
      .optional(),
    BAN_ENCRYPTION_SECRET: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, "BAN_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes)")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.BAN_HASH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["BAN_HASH_SECRET"],
          message: "BAN_HASH_SECRET is required in production and must be at least 32 characters",
        });
      } else if (!isProductionSecretSecure(data.BAN_HASH_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["BAN_HASH_SECRET"],
          message: "BAN_HASH_SECRET cannot use predictable, sequential, repeating, or development values in production",
        });
      }

      const effectiveEncKey = data.BAN_ENCRYPTION_KEY ?? data.BAN_ENCRYPTION_SECRET;
      if (!effectiveEncKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["BAN_ENCRYPTION_KEY"],
          message: "BAN_ENCRYPTION_KEY is required in production and must be a 64-character hex string",
        });
      } else if (!isProductionSecretSecure(effectiveEncKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [data.BAN_ENCRYPTION_KEY ? "BAN_ENCRYPTION_KEY" : "BAN_ENCRYPTION_SECRET"],
          message: "BAN_ENCRYPTION_KEY cannot use predictable, sequential, repeating, or development values in production",
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    BAN_ENCRYPTION_KEY: data.BAN_ENCRYPTION_KEY ?? data.BAN_ENCRYPTION_SECRET,
  }));

export type Env = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid environment variables. Check your .env file.");
}

export const env = parsedEnv.data;
