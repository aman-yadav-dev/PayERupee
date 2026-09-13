import fs from "fs/promises";
import path from "path";
import {
  IStorageProvider,
  StorageError,
  StorageKeyError,
  StorageNotFoundError,
} from "./storage.types";
import { logger } from "../logger/logger";

export class LocalDiskStorageAdapter implements IStorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    const configuredDir = baseDir || process.env.LOCAL_STORAGE_PATH || ".storage";
    // Resolve to an absolute path immediately so traversal checks are reliable
    this.baseDir = path.resolve(process.cwd(), configuredDir);
  }

  /**
   * Validates and securely resolves a storage key to an absolute filesystem path.
   * Protects against absolute path injection and directory traversal.
   */
  private resolveKey(key: string): string {
    if (!key || typeof key !== "string") {
      throw new StorageKeyError("Storage key must be a non-empty string");
    }

    // Basic heuristic rejections for safety
    if (key.includes("\0")) {
      throw new StorageKeyError("Storage key contains invalid characters");
    }
    if (path.isAbsolute(key)) {
      throw new StorageKeyError("Absolute paths are not allowed as storage keys");
    }
    if (key.includes("..")) {
      throw new StorageKeyError("Directory traversal is not allowed in storage keys");
    }

    const fullPath = path.resolve(this.baseDir, key);

    // Final security barrier: ensure the resolved path actually stays within baseDir
    // Adding path.sep ensures we don't allow sibling directories that start with the same prefix
    // (e.g. if baseDir is "/storage", we reject "/storage_backup/file")
    if (!fullPath.startsWith(this.baseDir + path.sep) && fullPath !== this.baseDir) {
      throw new StorageKeyError("Storage key escapes the configured storage root");
    }

    return fullPath;
  }

  async put(key: string, data: Buffer, mimeType?: string): Promise<void> {
    try {
      const fullPath = this.resolveKey(key);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, data);
    } catch (error: any) {
      if (error instanceof StorageError) throw error;
      logger.error("Failed to write to local storage", error);
      throw new StorageError("Storage write operation failed");
    }
  }

  async get(key: string): Promise<Buffer> {
    try {
      const fullPath = this.resolveKey(key);
      return await fs.readFile(fullPath);
    } catch (error: any) {
      if (error instanceof StorageError) throw error;
      if (error.code === "ENOENT") {
        throw new StorageNotFoundError();
      }
      logger.error("Failed to read from local storage", error);
      throw new StorageError("Storage read operation failed");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullPath = this.resolveKey(key);
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error instanceof StorageError) throw error;
      if (error.code === "ENOENT") {
        // Idempotent delete: if it's already gone, consider it a success
        return;
      }
      logger.error("Failed to delete from local storage", error);
      throw new StorageError("Storage delete operation failed");
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullPath = this.resolveKey(key);
      await fs.access(fullPath, fs.constants.F_OK);
      return true;
    } catch (error: any) {
      if (error instanceof StorageError) throw error; // Re-throw key validation errors
      return false; // Any other error (like ENOENT) means it does not exist (or isn't accessible)
    }
  }
}
