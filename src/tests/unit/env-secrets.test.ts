import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import {
  isProductionSecretSecure,
  FORBIDDEN_SECRET_WORDS,
  envSchema,
} from "@/config/env";
import {
  BanCryptoService,
  BanCryptoConfigurationError,
} from "@/modules/ban/application/ban-crypto.service";

describe("Production Secret Quality Validation & Reconciliation", () => {
  const REPORTED_PREDICTABLE_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const getValidRandomKey = () => crypto.randomBytes(32).toString("hex");

  const createBaseProdEnv = () => ({
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
    BETTER_AUTH_SECRET: "secure_better_auth_random_secret_at_least_16_chars",
    BETTER_AUTH_URL: "https://payerupee.in",
    REDIS_URL: "redis://localhost:6379",
    NODE_ENV: "production" as const,
    BAN_HASH_SECRET: getValidRandomKey(),
    BAN_ENCRYPTION_KEY: getValidRandomKey(),
  });

  // =========================================================================
  // 1. isProductionSecretSecure - Pattern & Entropy Unit Tests
  // =========================================================================
  describe("1. isProductionSecretSecure Validator", () => {
    it("rejects the reported predictable 64-hex key", () => {
      expect(isProductionSecretSecure(REPORTED_PREDICTABLE_KEY)).toBe(false);
    });

    it("rejects all-same characters (e.g. 0000..., aaaa..., ffff...)", () => {
      expect(isProductionSecretSecure("0".repeat(64))).toBe(false);
      expect(isProductionSecretSecure("a".repeat(64))).toBe(false);
      expect(isProductionSecretSecure("f".repeat(64))).toBe(false);
      expect(isProductionSecretSecure("1".repeat(32))).toBe(false);
    });

    it("rejects low character diversity (< 8 unique characters)", () => {
      // 7 unique characters repeated
      const lowDiversity = "0123456".repeat(9).slice(0, 64);
      expect(isProductionSecretSecure(lowDiversity)).toBe(false);
    });

    it("rejects repeating 2-char, 4-char, 8-char, and 16-char patterns", () => {
      // 2-character repeating pattern
      const twoChar = "ab".repeat(32);
      expect(isProductionSecretSecure(twoChar)).toBe(false);

      const twoCharNumeric = "01".repeat(32);
      expect(isProductionSecretSecure(twoCharNumeric)).toBe(false);

      // 4-character repeating pattern
      const fourChar = "0123".repeat(16);
      expect(isProductionSecretSecure(fourChar)).toBe(false);

      const fourCharAlpha = "abcd".repeat(16);
      expect(isProductionSecretSecure(fourCharAlpha)).toBe(false);

      // 8-character repeating pattern
      const eightChar = "01234567".repeat(8);
      expect(isProductionSecretSecure(eightChar)).toBe(false);

      const eightCharNonSeq = "02468ace".repeat(8);
      expect(isProductionSecretSecure(eightCharNonSeq)).toBe(false);

      // 16-character repeating pattern (non-sequential)
      const sixteenCharNonSeq = "02468ace13579bdf".repeat(4);
      expect(isProductionSecretSecure(sixteenCharNonSeq)).toBe(false);

      // 32-character repeating pattern (repeated twice)
      const thirtyTwoChar = "02468ace13579bdf12345678abcdef01".repeat(2);
      expect(isProductionSecretSecure(thirtyTwoChar)).toBe(false);
    });

    it("rejects strings containing forbidden placeholder words case-insensitively", () => {
      for (const word of FORBIDDEN_SECRET_WORDS) {
        const candidateLower = `${word}_${getValidRandomKey()}`.slice(0, 64);
        const candidateUpper = `${word.toUpperCase()}_${getValidRandomKey()}`.slice(0, 64);
        const candidateMixed = `_${word[0].toUpperCase()}${word.slice(1)}_${getValidRandomKey()}`.slice(0, 64);

        expect(isProductionSecretSecure(candidateLower)).toBe(false);
        expect(isProductionSecretSecure(candidateUpper)).toBe(false);
        expect(isProductionSecretSecure(candidateMixed)).toBe(false);
      }
    });

    it("rejects ascending and descending sequential hex character runs", () => {
      // Ascending hex runs >= 8
      const ascendingRunStart = "0123456789abcdef" + getValidRandomKey().slice(16);
      expect(isProductionSecretSecure(ascendingRunStart)).toBe(false);

      const ascendingNumeric = "01234567" + getValidRandomKey().slice(8);
      expect(isProductionSecretSecure(ascendingNumeric)).toBe(false);

      // Descending hex runs >= 8
      const descendingRunStart = "fedcba9876543210" + getValidRandomKey().slice(16);
      expect(isProductionSecretSecure(descendingRunStart)).toBe(false);

      const descendingNumeric = "76543210" + getValidRandomKey().slice(8);
      expect(isProductionSecretSecure(descendingNumeric)).toBe(false);
    });

    it("accepts genuine high-entropy random 64-hex strings", () => {
      for (let i = 0; i < 50; i++) {
        const genuineKey = crypto.randomBytes(32).toString("hex");
        expect(isProductionSecretSecure(genuineKey)).toBe(true);
      }
    });

    it("accepts genuine high-entropy random HMAC secrets (>= 32 chars)", () => {
      for (let i = 0; i < 20; i++) {
        const genuineHmacSecret = crypto.randomBytes(32).toString("base64");
        expect(isProductionSecretSecure(genuineHmacSecret)).toBe(true);
      }
    });

    it("rejects empty, null, or non-string values safely", () => {
      expect(isProductionSecretSecure("")).toBe(false);
      expect(isProductionSecretSecure(null as unknown as string)).toBe(false);
      expect(isProductionSecretSecure(undefined as unknown as string)).toBe(false);
    });
  });

  // =========================================================================
  // 2. envSchema Validation in Production
  // =========================================================================
  describe("2. envSchema Validation in Production", () => {
    it("accepts valid high-entropy secrets in production", () => {
      const validEnv = createBaseProdEnv();
      const result = envSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.BAN_ENCRYPTION_KEY).toBe(validEnv.BAN_ENCRYPTION_KEY);
        expect(result.data.BAN_HASH_SECRET).toBe(validEnv.BAN_HASH_SECRET);
      }
    });

    it("rejects predictable BAN_ENCRYPTION_KEY in production without leaking secret", () => {
      const prodEnv = {
        ...createBaseProdEnv(),
        BAN_ENCRYPTION_KEY: REPORTED_PREDICTABLE_KEY,
      };

      const result = envSchema.safeParse(prodEnv);
      expect(result.success).toBe(false);

      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes("BAN_ENCRYPTION_KEY"));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe(
          "BAN_ENCRYPTION_KEY cannot use predictable, sequential, repeating, or development values in production"
        );
        // CRITICAL: Ensure secret value is never logged or interpolated into the error message
        expect(issue?.message).not.toContain(REPORTED_PREDICTABLE_KEY);
      }
    });

    it("rejects predictable BAN_HASH_SECRET in production without leaking secret", () => {
      const predictableHashSecret = "dev_secret_dummy_placeholder_0123456789abcdef";
      const prodEnv = {
        ...createBaseProdEnv(),
        BAN_HASH_SECRET: predictableHashSecret,
      };

      const result = envSchema.safeParse(prodEnv);
      expect(result.success).toBe(false);

      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes("BAN_HASH_SECRET"));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe(
          "BAN_HASH_SECRET cannot use predictable, sequential, repeating, or development values in production"
        );
        expect(issue?.message).not.toContain(predictableHashSecret);
      }
    });

    it("rejects missing BAN_HASH_SECRET in production", () => {
      const prodEnv = createBaseProdEnv();
      delete (prodEnv as { BAN_HASH_SECRET?: string }).BAN_HASH_SECRET;

      const result = envSchema.safeParse(prodEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes("BAN_HASH_SECRET"));
        expect(issue).toBeDefined();
        expect(issue?.message).toContain("BAN_HASH_SECRET is required in production");
      }
    });

    it("rejects when both BAN_ENCRYPTION_KEY and BAN_ENCRYPTION_SECRET are missing in production", () => {
      const prodEnv = createBaseProdEnv();
      delete (prodEnv as { BAN_ENCRYPTION_KEY?: string }).BAN_ENCRYPTION_KEY;

      const result = envSchema.safeParse(prodEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes("BAN_ENCRYPTION_KEY"));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe(
          "BAN_ENCRYPTION_KEY is required in production and must be a 64-character hex string"
        );
      }
    });

    it("supports backward compatibility: accepts BAN_ENCRYPTION_SECRET when BAN_ENCRYPTION_KEY is omitted", () => {
      const secretHex = getValidRandomKey();
      const prodEnv = {
        ...createBaseProdEnv(),
        BAN_ENCRYPTION_KEY: undefined,
        BAN_ENCRYPTION_SECRET: secretHex,
      };

      const result = envSchema.safeParse(prodEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        // Effective BAN_ENCRYPTION_KEY is populated from BAN_ENCRYPTION_SECRET
        expect(result.data.BAN_ENCRYPTION_KEY).toBe(secretHex);
        expect(result.data.BAN_ENCRYPTION_SECRET).toBe(secretHex);
      }
    });

    it("prioritizes BAN_ENCRYPTION_KEY over BAN_ENCRYPTION_SECRET when both are provided", () => {
      const keyHex = getValidRandomKey();
      const secretHex = getValidRandomKey();
      const prodEnv = {
        ...createBaseProdEnv(),
        BAN_ENCRYPTION_KEY: keyHex,
        BAN_ENCRYPTION_SECRET: secretHex,
      };

      const result = envSchema.safeParse(prodEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.BAN_ENCRYPTION_KEY).toBe(keyHex);
      }
    });

    it("rejects predictable BAN_ENCRYPTION_SECRET when BAN_ENCRYPTION_KEY is omitted", () => {
      const prodEnv = {
        ...createBaseProdEnv(),
        BAN_ENCRYPTION_KEY: undefined,
        BAN_ENCRYPTION_SECRET: REPORTED_PREDICTABLE_KEY,
      };

      const result = envSchema.safeParse(prodEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes("BAN_ENCRYPTION_SECRET"));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe(
          "BAN_ENCRYPTION_KEY cannot use predictable, sequential, repeating, or development values in production"
        );
        expect(issue?.message).not.toContain(REPORTED_PREDICTABLE_KEY);
      }
    });
  });

  // =========================================================================
  // 3. BanCryptoService Backward Compatibility
  // =========================================================================
  describe("3. BanCryptoService Backward Compatibility with BAN_ENCRYPTION_SECRET", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      delete process.env.BAN_ENCRYPTION_KEY;
      delete process.env.BAN_ENCRYPTION_SECRET;
      delete process.env.BAN_ENCRYPTION_KEY_V1;
      delete process.env.BAN_ENCRYPTION_SECRET_V1;
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("resolves encryption key when only BAN_ENCRYPTION_SECRET is set in environment", () => {
      const validKeyHex = getValidRandomKey();
      process.env.BAN_ENCRYPTION_SECRET = validKeyHex;

      const service = new BanCryptoService();
      const destination = "UPI:user@okaxis";

      const encrypted = service.encryptDestination(destination);
      expect(encrypted.encryptionKeyVersion).toBe("v1");

      const decrypted = service.decryptDestination(encrypted.encryptedDestination);
      expect(decrypted).toBe(destination);
    });

    it("resolves encryption key when only BAN_ENCRYPTION_SECRET_V1 is set in environment", () => {
      const validKeyHex = getValidRandomKey();
      process.env.BAN_ENCRYPTION_SECRET_V1 = validKeyHex;

      const service = new BanCryptoService();
      const destination = "BANK:1234567890:HDFC0001234";

      const encrypted = service.encryptDestination(destination);
      const decrypted = service.decryptDestination(encrypted.encryptedDestination);
      expect(decrypted).toBe(destination);
    });

    it("prioritizes BAN_ENCRYPTION_KEY over BAN_ENCRYPTION_SECRET in BanCryptoService", () => {
      const keyPrimary = getValidRandomKey();
      const keySecondary = getValidRandomKey();

      process.env.BAN_ENCRYPTION_KEY = keyPrimary;
      process.env.BAN_ENCRYPTION_SECRET = keySecondary;

      const service = new BanCryptoService();
      const destination = "UPI:primary@okaxis";

      const encrypted = service.encryptDestination(destination);

      // Successfully decrypts with primary key
      const decrypted = service.decryptDestination(encrypted.encryptedDestination, {
        keyHex: keyPrimary,
      });
      expect(decrypted).toBe(destination);

      // Fails to decrypt with secondary key since primary was used
      expect(() =>
        service.decryptDestination(encrypted.encryptedDestination, {
          keyHex: keySecondary,
        })
      ).toThrow();
    });

    it("resolves versioned key via BAN_ENCRYPTION_SECRET_<VER>", () => {
      const validKeyHexV2 = getValidRandomKey();
      process.env.BAN_ENCRYPTION_SECRET_V2 = validKeyHexV2;

      const service = new BanCryptoService();
      service.setActiveEncryptionKeyVersion("v2");

      const destination = "UPI:v2user@okaxis";
      const encrypted = service.encryptDestination(destination);
      expect(encrypted.encryptionKeyVersion).toBe("v2");

      const decrypted = service.decryptDestination(encrypted.encryptedDestination);
      expect(decrypted).toBe(destination);
    });

    it("throws BanCryptoConfigurationError when neither KEY nor SECRET is configured", () => {
      const emptyService = new BanCryptoService();
      expect(() => emptyService.encryptDestination("UPI:orphan@okaxis")).toThrow(
        BanCryptoConfigurationError
      );
    });
  });
});
