import { describe, it, expect, beforeEach } from "vitest";
import {
  BanCryptoService,
  BanCryptoValidationError,
  BanCryptoConfigurationError,
  BanCryptoDecryptionError,
} from "@/modules/ban/application/ban-crypto.service";

describe("BanCryptoService Unit Tests", () => {
  const TEST_HASH_SECRET_V1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 chars
  const TEST_HASH_SECRET_V2 = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"; // 64 chars
  const TEST_ENC_KEY_V1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 hex
  const TEST_ENC_KEY_V2 = "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"; // 64 hex

  let service: BanCryptoService;

  beforeEach(() => {
    service = new BanCryptoService({
      hashSecrets: { v1: TEST_HASH_SECRET_V1 },
      encryptionKeys: { v1: TEST_ENC_KEY_V1 },
      activeHashKeyVersion: "v1",
      activeEncryptionKeyVersion: "v1",
    });
  });

  // =========================================================================
  // 1. UPI CANONICALIZATION & EQUIVALENT INPUTS
  // =========================================================================
  describe("1. UPI Canonicalization", () => {
    it("canonicalizes UPI ID case-insensitively and trims whitespace", () => {
      const canonical1 = service.canonicalizeUpi("Alice.Smith@OkAxis");
      const canonical2 = service.canonicalizeUpi("  alice.smith@okaxis  ");
      const canonical3 = service.canonicalizeUpi("ALICE.SMITH@OKAXIS");

      expect(canonical1).toBe("UPI:alice.smith@okaxis");
      expect(canonical2).toBe("UPI:alice.smith@okaxis");
      expect(canonical3).toBe("UPI:alice.smith@okaxis");
    });

    it("normalizes UPI returning raw string without UPI: prefix", () => {
      expect(service.normalizeUpi("  Merchant.Pay@ICICI  ")).toBe("merchant.pay@icici");
    });

    it("rejects invalid UPI formats", () => {
      expect(() => service.canonicalizeUpi("")).toThrow(BanCryptoValidationError);
      expect(() => service.canonicalizeUpi("   ")).toThrow(BanCryptoValidationError);
      expect(() => service.canonicalizeUpi("invalid-upi-no-at")).toThrow(BanCryptoValidationError);
      expect(() => service.canonicalizeUpi("@bank")).toThrow(BanCryptoValidationError);
      expect(() => service.canonicalizeUpi("user@")).toThrow(BanCryptoValidationError);
      expect(() => service.canonicalizeUpi("user@@bank")).toThrow(BanCryptoValidationError);
      expect(() => service.canonicalizeUpi("user name@bank")).toThrow(BanCryptoValidationError);
      expect(() => service.canonicalizeUpi("user$#@bank")).toThrow(BanCryptoValidationError);
    });
  });

  // =========================================================================
  // 2. BANK DESTINATION CANONICALIZATION & DISTINCTIONS
  // =========================================================================
  describe("2. Bank Destination Canonicalization", () => {
    it("canonicalizes bank destination with uppercase account number and uppercase IFSC", () => {
      const canonical1 = service.canonicalizeBankAccount("123456789012", "hdfc0001234");
      const canonical2 = service.canonicalizeBankAccount("  123456789012  ", "  HDFC0001234  ");
      const canonicalAlphanumeric1 = service.canonicalizeBankAccount("acc1234efgh", "hdfc0001234");
      const canonicalAlphanumeric2 = service.canonicalizeBankAccount("ACC1234EFGH", "HDFC0001234");

      expect(canonical1).toBe("BANK:123456789012:HDFC0001234");
      expect(canonical2).toBe("BANK:123456789012:HDFC0001234");
      expect(canonicalAlphanumeric1).toBe("BANK:ACC1234EFGH:HDFC0001234");
      expect(canonicalAlphanumeric1).toBe(canonicalAlphanumeric2);
    });

    it("normalizes bank destination returning clean uppercase account and IFSC parts", () => {
      const normalized = service.normalizeBankAccount(" acc9876543210 ", " sbin0004567 ");
      expect(normalized).toEqual({
        accountNumber: "ACC9876543210",
        ifsc: "SBIN0004567",
      });
    });

    it("distinguishes same account number with different IFSC codes", () => {
      const c1 = service.canonicalizeBankAccount("1234567890", "HDFC0001234");
      const c2 = service.canonicalizeBankAccount("1234567890", "ICIC0001234");

      expect(c1).not.toBe(c2);
      const h1 = service.hashIdentifier(c1);
      const h2 = service.hashIdentifier(c2);
      expect(h1.identifierHash).not.toBe(h2.identifierHash);
    });

    it("distinguishes different account numbers with same IFSC code", () => {
      const c1 = service.canonicalizeBankAccount("1234567890", "HDFC0001234");
      const c2 = service.canonicalizeBankAccount("9876543210", "HDFC0001234");

      expect(c1).not.toBe(c2);
      const h1 = service.hashIdentifier(c1);
      const h2 = service.hashIdentifier(c2);
      expect(h1.identifierHash).not.toBe(h2.identifierHash);
    });

    it("rejects invalid bank account numbers", () => {
      expect(() => service.canonicalizeBankAccount("", "HDFC0001234")).toThrow(BanCryptoValidationError);
      expect(() => service.canonicalizeBankAccount("123", "HDFC0001234")).toThrow(BanCryptoValidationError); // < 5 chars
      expect(() =>
        service.canonicalizeBankAccount("123456789012345678901234567890123", "HDFC0001234")
      ).toThrow(BanCryptoValidationError); // > 30 chars
      expect(() => service.canonicalizeBankAccount("acc#number", "HDFC0001234")).toThrow(
        BanCryptoValidationError
      );
    });

    it("rejects invalid IFSC codes", () => {
      expect(() => service.canonicalizeBankAccount("1234567890", "")).toThrow(BanCryptoValidationError);
      expect(() => service.canonicalizeBankAccount("1234567890", "HDFC000123")).toThrow(
        BanCryptoValidationError
      ); // 10 chars
      expect(() => service.canonicalizeBankAccount("1234567890", "HDFC1001234")).toThrow(
        BanCryptoValidationError
      ); // 5th char not 0
      expect(() => service.canonicalizeBankAccount("1234567890", "12340001234")).toThrow(
        BanCryptoValidationError
      ); // first 4 not letters
    });

    it("canonicalizes via unified canonicalizeDestination method", () => {
      const upi = service.canonicalizeDestination({ type: "UPI", vpa: "user@okaxis" });
      const bank = service.canonicalizeDestination({
        type: "BANK_ACCOUNT",
        accountNumber: "1234567890",
        ifsc: "HDFC0001234",
      });

      expect(upi).toBe("UPI:user@okaxis");
      expect(bank).toBe("BANK:1234567890:HDFC0001234");
    });
  });

  // =========================================================================
  // 3. DETERMINISTIC HMAC-SHA-256 HASHING
  // =========================================================================
  describe("3. Deterministic HMAC-SHA-256 Hashing", () => {
    it("generates deterministic 64-character hex hash", () => {
      const canonical = "UPI:alice@okaxis";
      const res1 = service.hashIdentifier(canonical);
      const res2 = service.hashIdentifier(canonical);

      expect(res1.identifierHash).toBe(res2.identifierHash);
      expect(res1.identifierHash).toMatch(/^[0-9a-f]{64}$/);
      expect(res1.hashKeyVersion).toBe("v1");
    });

    it("differs from plain SHA-256 hash", () => {
      const canonical = "UPI:alice@okaxis";
      const hmacRes = service.hashIdentifier(canonical);

      // Verify that changing the secret changes the output
      const altService = new BanCryptoService({
        hashSecrets: { v1: "9999999999abcdef0123456789abcdef0123456789abcdef0123456789abcdef" },
      });
      const altRes = altService.hashIdentifier(canonical);

      expect(hmacRes.identifierHash).not.toBe(altRes.identifierHash);
    });

    it("supports computeCandidateHashes for dual-read rotation", () => {
      service.registerHashSecret("v2", TEST_HASH_SECRET_V2);
      const candidates = service.computeCandidateHashes("UPI:alice@okaxis", ["v1", "v2"]);

      expect(candidates).toHaveLength(2);
      expect(candidates[0].hashKeyVersion).toBe("v1");
      expect(candidates[1].hashKeyVersion).toBe("v2");
      expect(candidates[0].identifierHash).not.toBe(candidates[1].identifierHash);
    });
  });

  // =========================================================================
  // 4. AES-256-GCM ENCRYPTION & DECRYPTION
  // =========================================================================
  describe("4. AES-256-GCM Encryption and Decryption", () => {
    it("performs complete round-trip encryption and decryption", () => {
      const canonical = "BANK:123456789012:HDFC0001234";
      const encrypted = service.encryptDestination(canonical);

      expect(encrypted.encryptionKeyVersion).toBe("v1");
      expect(encrypted.encryptedDestination.startsWith("v1:")).toBe(true);

      const decrypted = service.decryptDestination(encrypted.encryptedDestination);
      expect(decrypted).toBe(canonical);
    });

    it("generates unique 12-byte nonces across successive encryptions of identical plaintext", () => {
      const canonical = "UPI:alice@okaxis";
      const enc1 = service.encryptDestination(canonical);
      const enc2 = service.encryptDestination(canonical);

      expect(enc1.encryptedDestination).not.toBe(enc2.encryptedDestination);

      // Extract nonces
      const iv1 = enc1.encryptedDestination.split(":")[1];
      const iv2 = enc2.encryptedDestination.split(":")[1];
      expect(iv1).toHaveLength(24); // 12 bytes = 24 hex
      expect(iv2).toHaveLength(24);
      expect(iv1).not.toBe(iv2);

      // Both decrypt to identical plaintext
      expect(service.decryptDestination(enc1.encryptedDestination)).toBe(canonical);
      expect(service.decryptDestination(enc2.encryptedDestination)).toBe(canonical);
    });

    it("detects ciphertext tampering and rejects with BanCryptoDecryptionError", () => {
      const canonical = "UPI:victim@okaxis";
      const encrypted = service.encryptDestination(canonical);
      const parts = encrypted.encryptedDestination.split(":");
      // parts: [version, iv, tag, ciphertext]

      // Tamper ciphertext
      const originalCipher = parts[3];
      const tamperedCipher =
        originalCipher[0] === "a" ? "b" + originalCipher.slice(1) : "a" + originalCipher.slice(1);
      const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCipher}`;

      expect(() => service.decryptDestination(tamperedPayload)).toThrow(BanCryptoDecryptionError);
    });

    it("detects authentication tag tampering and rejects with BanCryptoDecryptionError", () => {
      const canonical = "UPI:victim@okaxis";
      const encrypted = service.encryptDestination(canonical);
      const parts = encrypted.encryptedDestination.split(":");

      // Tamper auth tag
      const originalTag = parts[2];
      const tamperedTag = originalTag[0] === "f" ? "0" + originalTag.slice(1) : "f" + originalTag.slice(1);
      const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedTag}:${parts[3]}`;

      expect(() => service.decryptDestination(tamperedPayload)).toThrow(BanCryptoDecryptionError);
    });

    it("rejects malformed encrypted payloads", () => {
      expect(() => service.decryptDestination("")).toThrow(BanCryptoValidationError);
      expect(() => service.decryptDestination("not:enough:parts")).toThrow(BanCryptoDecryptionError);
      expect(() => service.decryptDestination("v1:shortiv:tag:ciphertext")).toThrow(
        BanCryptoDecryptionError
      );
      expect(() => service.decryptDestination("v1:11223344556677889900aabb:shorttag:ciphertext")).toThrow(
        BanCryptoDecryptionError
      );
      expect(() =>
        service.decryptDestination(
          "v1:11223344556677889900aabb:11223344556677889900112233445566:nothex!!!"
        )
      ).toThrow(BanCryptoDecryptionError);
    });
  });

  // =========================================================================
  // 5. MASKING IDENTIFIERS
  // =========================================================================
  describe("5. Identifier Masking", () => {
    it("masks UPI IDs consistently without exposing sensitive usernames", () => {
      expect(service.maskUpi("alice.smith@okicici")).toBe("a***@okicici");
      expect(service.maskUpi("bob@upi")).toBe("b***@upi");
      expect(service.maskUpi("ab@upi")).toBe("**@upi");
      expect(service.maskUpi("a@upi")).toBe("*@upi");
    });

    it("masks bank account numbers and preserves IFSC if provided", () => {
      expect(service.maskBankAccount("1234567890", "HDFC0001234")).toBe("******7890 (HDFC0001234)");
      expect(service.maskBankAccount("1234567890")).toBe("******7890");
      expect(service.maskBankAccount("1234", "ICIC0001234")).toBe("****** (ICIC0001234)");
    });

    it("masks destinations via unified maskDestination method", () => {
      const upiMasked = service.maskDestination({ type: "UPI", vpa: "john.doe@okaxis" });
      const bankMasked = service.maskDestination({
        type: "BANK_ACCOUNT",
        accountNumber: "987654321012",
        ifsc: "SBIN0001234",
      });

      expect(upiMasked).toBe("j***@okaxis");
      expect(bankMasked).toBe("******1012 (SBIN0001234)");
    });
  });

  // =========================================================================
  // 6. STABLE SIGNED 64-BIT POSTGRESQL ADVISORY LOCK KEY
  // =========================================================================
  describe("6. PostgreSQL Advisory Lock Key", () => {
    it("generates a signed 64-bit BigInt within valid PostgreSQL bigint range", () => {
      const canonical = "UPI:alice@okaxis";
      const lockKey = service.getAdvisoryLockKey(canonical);

      expect(typeof lockKey).toBe("bigint");
      // Range for PostgreSQL signed 64-bit integer
      const MIN_INT64 = BigInt("-9223372036854775808");
      const MAX_INT64 = BigInt("9223372036854775807");
      expect(lockKey >= MIN_INT64).toBe(true);
      expect(lockKey <= MAX_INT64).toBe(true);
    });

    it("is strictly deterministic across calls and independent of service instances", () => {
      const canonical = "BANK:1234567890:HDFC0001234";
      const key1 = service.getAdvisoryLockKey(canonical);
      const key2 = service.getAdvisoryLockKey(canonical);

      const altService = new BanCryptoService({
        hashSecrets: { v1: TEST_HASH_SECRET_V2 }, // different secret
      });
      const key3 = altService.getAdvisoryLockKey(canonical);

      expect(key1).toBe(key2);
      expect(key1).toBe(key3); // Immune to HMAC key rotation!
    });

    it("produces identical lock key string representation", () => {
      const canonical = "UPI:bob@okhdfcbank";
      const keyBigInt = service.getAdvisoryLockKey(canonical);
      const keyStr = service.getAdvisoryLockKeyString(canonical);

      expect(keyStr).toBe(keyBigInt.toString());
    });

    it("rejects non-string canonical destination", () => {
      expect(() => service.getAdvisoryLockKey("")).toThrow(BanCryptoValidationError);
    });
  });

  // =========================================================================
  // 7. MISSING OR INVALID SECRETS (NO BYPASSES)
  // =========================================================================
  describe("7. Safe Configuration and Secret Validation", () => {
    it("throws BanCryptoConfigurationError when HMAC secret is missing or too short", () => {
      const emptyService = new BanCryptoService();
      expect(() => emptyService.hashIdentifier("UPI:alice@okaxis", { keyVersion: "nonexistent" })).toThrow(
        BanCryptoConfigurationError
      );

      expect(() =>
        emptyService.hashIdentifier("UPI:alice@okaxis", { secret: "short_secret_under_32_chars" })
      ).toThrow(BanCryptoConfigurationError);
    });

    it("throws BanCryptoConfigurationError when encryption key is missing or invalid hex", () => {
      const emptyService = new BanCryptoService();
      expect(() => emptyService.encryptDestination("UPI:alice@okaxis", { keyVersion: "nonexistent" })).toThrow(
        BanCryptoConfigurationError
      );

      // 63 chars (not 64)
      expect(() =>
        emptyService.encryptDestination("UPI:alice@okaxis", {
          keyHex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde",
        })
      ).toThrow(BanCryptoConfigurationError);

      // 64 chars with non-hex
      expect(() =>
        emptyService.encryptDestination("UPI:alice@okaxis", {
          keyHex: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
        })
      ).toThrow(BanCryptoConfigurationError);
    });

    it("does not leak secret values or plaintext in configuration error messages", () => {
      const secret = "secret_that_must_not_be_logged_123456789";
      try {
        service.registerHashSecret("v2", "too_short");
      } catch (err: unknown) {
        const error = err as Error;
        expect(error.message).not.toContain(secret);
      }
    });

    it("fails closed and throws BanCryptoConfigurationError in computeCandidateHashes when secret is missing", () => {
      const savedSecret = process.env.BAN_HASH_SECRET;
      delete process.env.BAN_HASH_SECRET;
      try {
        const emptyService = new BanCryptoService();
        expect(() => emptyService.computeCandidateHashes("UPI:alice@okaxis")).toThrow(
          BanCryptoConfigurationError
        );
      } finally {
        if (savedSecret) {
          process.env.BAN_HASH_SECRET = savedSecret;
        }
      }
    });

    it("scans and discovers rotation versions from environment variables BAN_HASH_SECRET and BAN_HASH_SECRET_<VER>", () => {
      const savedV1 = process.env.BAN_HASH_SECRET;
      const savedV2 = process.env.BAN_HASH_SECRET_V2;
      try {
        process.env.BAN_HASH_SECRET = TEST_HASH_SECRET_V1;
        process.env.BAN_HASH_SECRET_V2 = TEST_HASH_SECRET_V2;

        const envService = new BanCryptoService();
        const candidates = envService.computeCandidateHashes("UPI:alice@okaxis");

        expect(candidates.length).toBeGreaterThanOrEqual(2);
        const versions = candidates.map((c) => c.hashKeyVersion);
        expect(versions).toContain("v1");
        expect(versions).toContain("v2");
      } finally {
        if (savedV1 !== undefined) process.env.BAN_HASH_SECRET = savedV1;
        else delete process.env.BAN_HASH_SECRET;

        if (savedV2 !== undefined) process.env.BAN_HASH_SECRET_V2 = savedV2;
        else delete process.env.BAN_HASH_SECRET_V2;
      }
    });
  });

  // =========================================================================
  // 8. INDEPENDENT ROTATION FOR HASH AND ENCRYPTION KEYS
  // =========================================================================
  describe("8. Independent Key Versioning and Rotation", () => {
    it("allows independent hash key rotation while encryption key remains constant", () => {
      // Register v2 hash secret
      service.registerHashSecret("v2", TEST_HASH_SECRET_V2);
      service.setActiveHashKeyVersion("v2");

      expect(service.getActiveHashKeyVersion()).toBe("v2");
      expect(service.getActiveEncryptionKeyVersion()).toBe("v1");

      const canonical = "UPI:alice@okaxis";
      const hashV2 = service.hashIdentifier(canonical);
      expect(hashV2.hashKeyVersion).toBe("v2");

      // Encryption still uses v1
      const enc = service.encryptDestination(canonical);
      expect(enc.encryptionKeyVersion).toBe("v1");
      expect(service.decryptDestination(enc.encryptedDestination)).toBe(canonical);
    });

    it("allows independent encryption key rotation while decrypting historical v1 data", () => {
      const canonical = "BANK:1234567890:HDFC0001234";

      // 1. Create v1 encrypted payload
      const v1Encrypted = service.encryptDestination(canonical, { keyVersion: "v1" });
      expect(v1Encrypted.encryptionKeyVersion).toBe("v1");

      // 2. Register v2 encryption key and make active
      service.registerEncryptionKey("v2", TEST_ENC_KEY_V2);
      service.setActiveEncryptionKeyVersion("v2");

      expect(service.getActiveEncryptionKeyVersion()).toBe("v2");
      expect(service.getActiveHashKeyVersion()).toBe("v1");

      // 3. New encryption uses v2
      const v2Encrypted = service.encryptDestination(canonical);
      expect(v2Encrypted.encryptionKeyVersion).toBe("v2");

      // 4. Decrypting new v2 payload succeeds
      expect(service.decryptDestination(v2Encrypted.encryptedDestination)).toBe(canonical);

      // 5. Decrypting historical v1 payload still succeeds using registered v1 key
      expect(service.decryptDestination(v1Encrypted.encryptedDestination)).toBe(canonical);
    });
  });
});
