import crypto from "crypto";
import { BanDestinationType } from "@prisma/client";

export { BanDestinationType };

export interface UpiDestinationInput {
  type: "UPI";
  vpa: string;
}

export interface BankDestinationInput {
  type: "BANK_ACCOUNT";
  accountNumber: string;
  ifsc: string;
}

export type BanDestinationInput = UpiDestinationInput | BankDestinationInput;

export interface EncryptedPayload {
  encryptedDestination: string;
  encryptionKeyVersion: string;
}

export interface HashedIdentifier {
  identifierHash: string;
  hashKeyVersion: string;
}

export interface BanCryptoConfig {
  hashSecrets?: Record<string, string>; // version -> secret
  encryptionKeys?: Record<string, string>; // version -> 64-hex key
  activeHashKeyVersion?: string;
  activeEncryptionKeyVersion?: string;
}

export class BanCryptoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BanCryptoValidationError";
  }
}

export class BanCryptoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BanCryptoConfigurationError";
  }
}

export class BanCryptoDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BanCryptoDecryptionError";
  }
}

// UPI regex matching project conventions: letters, digits, dots, hyphens, underscores before & after @
const UPI_REGEX = /^[\w.-]+@[\w.-]+$/;

// Standard Indian Financial System Code (IFSC) regex: 4 letters, 0, 6 letters/digits
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// Bank account numbers: 5 to 30 alphanumeric/numeric characters
const ACCOUNT_NUMBER_REGEX = /^[A-Za-z0-9]{5,30}$/;

const DEFAULT_HASH_VERSION = "v1";
const DEFAULT_ENCRYPTION_VERSION = "v1";

export class BanCryptoService {
  private hashSecrets: Map<string, string>;
  private encryptionKeys: Map<string, Buffer>;
  private activeHashKeyVersion: string;
  private activeEncryptionKeyVersion: string;

  constructor(config?: BanCryptoConfig) {
    this.hashSecrets = new Map<string, string>();
    this.encryptionKeys = new Map<string, Buffer>();
    this.activeHashKeyVersion = config?.activeHashKeyVersion || DEFAULT_HASH_VERSION;
    this.activeEncryptionKeyVersion = config?.activeEncryptionKeyVersion || DEFAULT_ENCRYPTION_VERSION;

    if (config?.hashSecrets) {
      for (const [ver, secret] of Object.entries(config.hashSecrets)) {
        this.registerHashSecret(ver, secret);
      }
    }

    if (config?.encryptionKeys) {
      for (const [ver, keyHex] of Object.entries(config.encryptionKeys)) {
        this.registerEncryptionKey(ver, keyHex);
      }
    }
  }

  public registerHashSecret(version: string, secret: string): void {
    if (!version || typeof version !== "string") {
      throw new BanCryptoConfigurationError("Invalid hash key version string.");
    }
    if (!secret || typeof secret !== "string" || secret.length < 32) {
      throw new BanCryptoConfigurationError("BAN_HASH_SECRET must be at least 32 characters.");
    }
    this.hashSecrets.set(version, secret);
  }

  public registerEncryptionKey(version: string, keyHex: string): void {
    if (!version || typeof version !== "string") {
      throw new BanCryptoConfigurationError("Invalid encryption key version string.");
    }
    if (!keyHex || typeof keyHex !== "string" || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
      throw new BanCryptoConfigurationError(
        "BAN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)."
      );
    }
    this.encryptionKeys.set(version, Buffer.from(keyHex, "hex"));
  }

  public setActiveHashKeyVersion(version: string): void {
    if (!version) throw new BanCryptoConfigurationError("Active hash key version cannot be empty.");
    this.activeHashKeyVersion = version;
  }

  public setActiveEncryptionKeyVersion(version: string): void {
    if (!version) throw new BanCryptoConfigurationError("Active encryption key version cannot be empty.");
    this.activeEncryptionKeyVersion = version;
  }

  public getActiveHashKeyVersion(): string {
    return this.activeHashKeyVersion;
  }

  public getActiveEncryptionKeyVersion(): string {
    return this.activeEncryptionKeyVersion;
  }

  private getEnvHashVersions(): string[] {
    const envVersions: string[] = [];
    if (typeof process !== "undefined" && process.env) {
      if (process.env.BAN_HASH_SECRET !== undefined && process.env.BAN_HASH_SECRET !== "") {
        envVersions.push(DEFAULT_HASH_VERSION);
      }
      for (const [key, value] of Object.entries(process.env)) {
        if (value === undefined || value === "") continue;
        const match = key.match(/^BAN_HASH_SECRET_([A-Za-z0-9_]+)$/i);
        if (match && match[1]) {
          const rawVer = match[1].toLowerCase();
          const normalizedVer = /^\d+$/.test(rawVer) ? `v${rawVer}` : rawVer;
          envVersions.push(normalizedVer);
        }
      }
    }
    return envVersions;
  }

  private resolveHashSecret(version?: string): { secret: string; version: string } {
    const rawVer = version || this.activeHashKeyVersion;
    const normalizedVer = /^\d+$/.test(rawVer) ? `v${rawVer}` : rawVer;

    if (this.hashSecrets.has(rawVer)) {
      const secret = this.hashSecrets.get(rawVer)!;
      if (!secret || typeof secret !== "string" || secret.length < 32) {
        throw new BanCryptoConfigurationError(
          `No valid HMAC secret configured for hash key version '${rawVer}'. Secret must be at least 32 characters.`
        );
      }
      return { secret, version: rawVer };
    }

    if (this.hashSecrets.has(normalizedVer)) {
      const secret = this.hashSecrets.get(normalizedVer)!;
      if (!secret || typeof secret !== "string" || secret.length < 32) {
        throw new BanCryptoConfigurationError(
          `No valid HMAC secret configured for hash key version '${normalizedVer}'. Secret must be at least 32 characters.`
        );
      }
      return { secret, version: normalizedVer };
    }

    // Fall back to environment variable if configured
    let envSecret: string | undefined;
    const upperNorm = normalizedVer.toUpperCase();
    const strippedNum = normalizedVer.replace(/^v/i, "");

    if (normalizedVer.toLowerCase() === DEFAULT_HASH_VERSION) {
      envSecret =
        process.env.BAN_HASH_SECRET ??
        process.env.BAN_HASH_SECRET_V1 ??
        process.env.BAN_HASH_SECRET_1;
    } else {
      envSecret =
        process.env[`BAN_HASH_SECRET_${upperNorm}`] ??
        process.env[`BAN_HASH_SECRET_${rawVer.toUpperCase()}`] ??
        (strippedNum ? process.env[`BAN_HASH_SECRET_${strippedNum}`] : undefined);
    }

    if (envSecret && typeof envSecret === "string" && envSecret.length >= 32) {
      return { secret: envSecret, version: normalizedVer };
    }

    throw new BanCryptoConfigurationError(
      `No valid HMAC secret configured for hash key version '${rawVer}'. Secret must be at least 32 characters.`
    );
  }

  private resolveEncryptionKey(version?: string): { key: Buffer; version: string } {
    const rawVer = version || this.activeEncryptionKeyVersion;
    const normalizedVer = /^\d+$/.test(rawVer) ? `v${rawVer}` : rawVer;

    if (this.encryptionKeys.has(rawVer)) {
      return { key: this.encryptionKeys.get(rawVer)!, version: rawVer };
    }
    if (this.encryptionKeys.has(normalizedVer)) {
      return { key: this.encryptionKeys.get(normalizedVer)!, version: normalizedVer };
    }

    // Fall back to environment variable if configured
    let envKeyHex: string | undefined;
    const upperNorm = normalizedVer.toUpperCase();
    const strippedNum = normalizedVer.replace(/^v/i, "");

    if (normalizedVer.toLowerCase() === DEFAULT_ENCRYPTION_VERSION) {
      envKeyHex =
        process.env.BAN_ENCRYPTION_KEY ??
        process.env.BAN_ENCRYPTION_SECRET ??
        process.env.BAN_ENCRYPTION_KEY_V1 ??
        process.env.BAN_ENCRYPTION_SECRET_V1 ??
        process.env.BAN_ENCRYPTION_KEY_1 ??
        process.env.BAN_ENCRYPTION_SECRET_1;
    } else {
      envKeyHex =
        process.env[`BAN_ENCRYPTION_KEY_${upperNorm}`] ??
        process.env[`BAN_ENCRYPTION_SECRET_${upperNorm}`] ??
        process.env[`BAN_ENCRYPTION_KEY_${rawVer.toUpperCase()}`] ??
        process.env[`BAN_ENCRYPTION_SECRET_${rawVer.toUpperCase()}`] ??
        (strippedNum
          ? (process.env[`BAN_ENCRYPTION_KEY_${strippedNum}`] ??
             process.env[`BAN_ENCRYPTION_SECRET_${strippedNum}`])
          : undefined);
    }

    if (envKeyHex && typeof envKeyHex === "string" && /^[0-9a-fA-F]{64}$/.test(envKeyHex)) {
      const keyBuf = Buffer.from(envKeyHex, "hex");
      return { key: keyBuf, version: normalizedVer };
    }

    throw new BanCryptoConfigurationError(
      `No valid encryption key configured for encryption key version '${rawVer}'. Key must be at least a 64-character hex string.`
    );
  }

  /**
   * 1. Canonicalize UPI ID
   * Lowercases, trims whitespace, verifies UPI format.
   * Returns domain-separated canonical string: 'UPI:<normalized_vpa>'
   */
  public canonicalizeUpi(vpa: string): string {
    if (!vpa || typeof vpa !== "string") {
      throw new BanCryptoValidationError("UPI ID must be a non-empty string.");
    }
    const trimmed = vpa.trim().toLowerCase();
    if (!UPI_REGEX.test(trimmed)) {
      throw new BanCryptoValidationError("Invalid UPI ID format. Expected format: username@bank");
    }
    const parts = trimmed.split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new BanCryptoValidationError("Invalid UPI ID structure.");
    }
    return `UPI:${trimmed}`;
  }

  /**
   * Returns normalized raw UPI ID (without UPI: prefix) for external display/querying.
   */
  public normalizeUpi(vpa: string): string {
    const canonical = this.canonicalizeUpi(vpa);
    return canonical.replace(/^UPI:/, "");
  }

  /**
   * 2. Canonicalize Bank Destination (Account Number + IFSC)
   * Trims whitespace, uppercases IFSC, validates RBI format.
   * Returns domain-separated canonical string: 'BANK:<account_number>:<ifsc>'
   */
  public canonicalizeBankAccount(accountNumber: string, ifsc: string): string {
    if (!accountNumber || typeof accountNumber !== "string") {
      throw new BanCryptoValidationError("Bank account number must be a non-empty string.");
    }
    if (!ifsc || typeof ifsc !== "string") {
      throw new BanCryptoValidationError("IFSC code must be a non-empty string.");
    }

    const cleanedAccount = accountNumber.trim().toUpperCase();
    if (!ACCOUNT_NUMBER_REGEX.test(cleanedAccount)) {
      throw new BanCryptoValidationError(
        "Invalid bank account number. Must be between 5 and 30 alphanumeric characters."
      );
    }

    const cleanedIfsc = ifsc.trim().toUpperCase();
    if (!IFSC_REGEX.test(cleanedIfsc)) {
      throw new BanCryptoValidationError(
        "Invalid IFSC code format. Expected 4 letters, followed by 0, followed by 6 alphanumeric characters."
      );
    }

    return `BANK:${cleanedAccount}:${cleanedIfsc}`;
  }

  /**
   * Returns normalized raw bank account data for external display/querying.
   */
  public normalizeBankAccount(
    accountNumber: string,
    ifsc: string
  ): { accountNumber: string; ifsc: string } {
    const canonical = this.canonicalizeBankAccount(accountNumber, ifsc);
    const parts = canonical.split(":");
    return {
      accountNumber: parts[1],
      ifsc: parts[2],
    };
  }

  /**
   * Canonicalize any valid ban destination input.
   */
  public canonicalizeDestination(input: BanDestinationInput): string {
    if (!input || !input.type) {
      throw new BanCryptoValidationError("Invalid destination input: missing type.");
    }
    if (input.type === "UPI") {
      return this.canonicalizeUpi(input.vpa);
    }
    if (input.type === "BANK_ACCOUNT") {
      return this.canonicalizeBankAccount(input.accountNumber, input.ifsc);
    }
    const rawType = (input as { type?: unknown }).type;
    throw new BanCryptoValidationError(`Unsupported destination type: ${String(rawType)}`);
  }

  /**
   * 3. Generate Deterministic HMAC-SHA-256 Identifier Hash
   * Uses secret for specified or active hash key version.
   */
  public hashIdentifier(
    canonicalDestination: string,
    options?: { keyVersion?: string; secret?: string }
  ): HashedIdentifier {
    if (!canonicalDestination || typeof canonicalDestination !== "string") {
      throw new BanCryptoValidationError("Canonical destination must be a non-empty string.");
    }

    let secret: string;
    let version: string;

    if (options?.secret) {
      if (typeof options.secret !== "string" || options.secret.length < 32) {
        throw new BanCryptoConfigurationError("Provided HMAC secret must be at least 32 characters.");
      }
      secret = options.secret;
      version = options?.keyVersion || this.activeHashKeyVersion;
    } else {
      const resolved = this.resolveHashSecret(options?.keyVersion);
      secret = resolved.secret;
      version = resolved.version;
    }

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(canonicalDestination, "utf8");
    const identifierHash = hmac.digest("hex");

    return {
      identifierHash,
      hashKeyVersion: version,
    };
  }

  /**
   * Computes identifier hashes across all specified or registered hash key versions.
   * Essential for dual-read queries during HMAC key rotation.
   * Fails closed if any active or configured version secret is missing or invalid.
   */
  public computeCandidateHashes(
    canonicalDestination: string,
    versions?: string[]
  ): HashedIdentifier[] {
    if (!canonicalDestination || typeof canonicalDestination !== "string") {
      throw new BanCryptoValidationError("Canonical destination must be a non-empty string.");
    }

    if (versions !== undefined && versions.length === 0) {
      throw new BanCryptoConfigurationError("Candidate hash versions list cannot be empty.");
    }

    const targetVersions =
      versions ||
      Array.from(
        new Set([
          this.activeHashKeyVersion,
          ...this.hashSecrets.keys(),
          ...this.getEnvHashVersions(),
        ])
      );

    const results: HashedIdentifier[] = [];

    for (const ver of targetVersions) {
      results.push(this.hashIdentifier(canonicalDestination, { keyVersion: ver }));
    }

    if (results.length === 0) {
      throw new BanCryptoConfigurationError(
        "Failed to compute destination candidate hashes. No valid HMAC secrets configured."
      );
    }

    return results;
  }

  /**
   * 4. Encrypt Canonical Destination with AES-256-GCM
   * Uses authenticated encryption with a fresh 12-byte random nonce per call.
   * Format: '<version>:<iv_hex>:<authTag_hex>:<ciphertext_hex>'
   */
  public encryptDestination(
    canonicalDestination: string,
    options?: { keyVersion?: string; keyHex?: string }
  ): EncryptedPayload {
    if (!canonicalDestination || typeof canonicalDestination !== "string") {
      throw new BanCryptoValidationError("Canonical destination must be a non-empty string.");
    }

    let key: Buffer;
    let version: string;

    if (options?.keyHex) {
      if (typeof options.keyHex !== "string" || !/^[0-9a-fA-F]{64}$/.test(options.keyHex)) {
        throw new BanCryptoConfigurationError("Provided encryption key must be a 64-character hex string.");
      }
      key = Buffer.from(options.keyHex, "hex");
      version = options?.keyVersion || this.activeEncryptionKeyVersion;
    } else {
      const resolved = this.resolveEncryptionKey(options?.keyVersion);
      key = resolved.key;
      version = resolved.version;
    }

    // Fresh 12-byte cryptographically secure nonce
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(canonicalDestination, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const serialized = `${version}:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;

    return {
      encryptedDestination: serialized,
      encryptionKeyVersion: version,
    };
  }

  /**
   * 4. Decrypt Canonical Destination with AES-256-GCM
   * Parses version, IV, tag, and ciphertext. Verifies authentication tag.
   */
  public decryptDestination(
    encryptedDestination: string,
    options?: { keyVersion?: string; keyHex?: string }
  ): string {
    if (!encryptedDestination || typeof encryptedDestination !== "string") {
      throw new BanCryptoValidationError("Encrypted destination must be a non-empty string.");
    }

    const parts = encryptedDestination.split(":");
    let version: string;
    let ivHex: string;
    let authTagHex: string;
    let ciphertextHex: string;

    if (parts.length === 4) {
      version = parts[0];
      ivHex = parts[1];
      authTagHex = parts[2];
      ciphertextHex = parts[3];
    } else if (parts.length === 3) {
      version = options?.keyVersion || this.activeEncryptionKeyVersion;
      ivHex = parts[0];
      authTagHex = parts[1];
      ciphertextHex = parts[2];
    } else {
      throw new BanCryptoDecryptionError("Malformed encrypted destination payload format.");
    }

    if (options?.keyVersion) {
      version = options.keyVersion;
    }

    if (!ivHex || !/^[0-9a-fA-F]{24}$/.test(ivHex)) {
      throw new BanCryptoDecryptionError("Malformed IV in encrypted payload. Expected 12 bytes hex.");
    }
    if (!authTagHex || !/^[0-9a-fA-F]{32}$/.test(authTagHex)) {
      throw new BanCryptoDecryptionError("Malformed Auth Tag in encrypted payload. Expected 16 bytes hex.");
    }
    if (!ciphertextHex || ciphertextHex.length === 0 || !/^[0-9a-fA-F]+$/.test(ciphertextHex)) {
      throw new BanCryptoDecryptionError("Malformed ciphertext in encrypted payload.");
    }

    let key: Buffer;
    if (options?.keyHex) {
      if (typeof options.keyHex !== "string" || !/^[0-9a-fA-F]{64}$/.test(options.keyHex)) {
        throw new BanCryptoConfigurationError("Provided encryption key must be a 64-character hex string.");
      }
      key = Buffer.from(options.keyHex, "hex");
    } else {
      const resolved = this.resolveEncryptionKey(version);
      key = resolved.key;
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");

      return plaintext;
    } catch {
      throw new BanCryptoDecryptionError("Authentication tag verification failed or ciphertext tampered.");
    }
  }

  /**
   * 5. Mask UPI Identifier
   * Preserves handle and first char of username when possible.
   * e.g., 'alice.smith@okicici' -> 'a***@okicici', 'bob@upi' -> 'b***@upi', 'ab@upi' -> '**@upi'
   */
  public maskUpi(vpa: string): string {
    if (!vpa || typeof vpa !== "string") {
      throw new BanCryptoValidationError("UPI ID must be a non-empty string.");
    }
    const cleanVpa = vpa.trim().toLowerCase();
    if (!cleanVpa.includes("@")) {
      throw new BanCryptoValidationError("Invalid UPI ID: missing @.");
    }
    const [user, domain] = cleanVpa.split("@");
    if (!domain) {
      throw new BanCryptoValidationError("Invalid UPI ID: missing handle.");
    }
    const maskedUser = user.length > 2 ? user.slice(0, 1) + "***" : "*".repeat(user.length);
    return `${maskedUser}@${domain}`;
  }

  /**
   * 5. Mask Bank Account Identifier
   * Masks account number keeping last 4 digits; appends IFSC if present.
   * e.g., '******7890 (HDFC0001234)'
   */
  public maskBankAccount(accountNumber: string, ifsc?: string): string {
    if (!accountNumber || typeof accountNumber !== "string") {
      throw new BanCryptoValidationError("Account number must be a non-empty string.");
    }
    const cleanedAccount = accountNumber.trim().toUpperCase();
    const maskedAccount =
      cleanedAccount.length > 4 ? "******" + cleanedAccount.slice(-4) : "******";

    if (ifsc && typeof ifsc === "string" && ifsc.trim().length > 0) {
      const cleanedIfsc = ifsc.trim().toUpperCase();
      return `${maskedAccount} (${cleanedIfsc})`;
    }

    return maskedAccount;
  }

  /**
   * 5. Mask destination from unified input.
   */
  public maskDestination(input: BanDestinationInput): string {
    if (!input || !input.type) {
      throw new BanCryptoValidationError("Invalid destination input: missing type.");
    }
    if (input.type === "UPI") {
      return this.maskUpi(input.vpa);
    }
    if (input.type === "BANK_ACCOUNT") {
      return this.maskBankAccount(input.accountNumber, input.ifsc);
    }
    const rawType = (input as { type?: unknown }).type;
    throw new BanCryptoValidationError(`Unsupported destination type: ${String(rawType)}`);
  }

  /**
   * 6. Generate Stable Signed 64-bit PostgreSQL Advisory-Lock Key
   * Derived deterministically via SHA-256 over canonicalDestination.
   * Independent of HMAC secret rotation. Same identity always yields same signed 64-bit BigInt.
   */
  public getAdvisoryLockKey(canonicalDestination: string): bigint {
    if (!canonicalDestination || typeof canonicalDestination !== "string") {
      throw new BanCryptoValidationError("Canonical destination must be a non-empty string.");
    }
    const hash = crypto.createHash("sha256").update(canonicalDestination, "utf8").digest();
    // Read first 8 bytes as big-endian signed 64-bit integer
    return hash.readBigInt64BE(0);
  }

  /**
   * Returns signed 64-bit advisory lock key as string for SQL query parameter binding.
   */
  public getAdvisoryLockKeyString(canonicalDestination: string): string {
    return this.getAdvisoryLockKey(canonicalDestination).toString();
  }
}

// Default singleton instance relying on environment variables
export const banCryptoService = new BanCryptoService();
