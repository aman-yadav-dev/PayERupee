import fs from "fs/promises";
import path from "path";
import os from "os";
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
    let configuredDir = baseDir || process.env.LOCAL_STORAGE_PATH;
    if (!configuredDir) {
      if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || (process.env.NODE_ENV === "production" && !baseDir)) {
        configuredDir = path.join(os.tmpdir(), "payerupee_storage");
      } else {
        configuredDir = ".storage";
      }
    }
    // Resolve to an absolute path immediately so traversal checks are reliable
    this.baseDir = path.isAbsolute(configuredDir) ? configuredDir : path.resolve(process.cwd(), configuredDir);
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
      if (error?.code === "EROFS" && !this.baseDir.startsWith(os.tmpdir())) {
        logger.warn("Read-only filesystem detected, switching storage to os.tmpdir()");
        this.baseDir = path.join(os.tmpdir(), "payerupee_storage");
        try {
          const fallbackPath = this.resolveKey(key);
          await fs.mkdir(path.dirname(fallbackPath), { recursive: true });
          await fs.writeFile(fallbackPath, data);
          return;
        } catch (retryErr: any) {
          if (retryErr instanceof StorageError) throw retryErr;
          logger.error("Failed to write to fallback local storage", retryErr);
          throw new StorageError("Storage write operation failed");
        }
      }
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
      if ((error?.code === "ENOENT" || error?.code === "EROFS") && !this.baseDir.startsWith(os.tmpdir())) {
        const fallbackBase = path.join(os.tmpdir(), "payerupee_storage");
        const fallbackPath = path.resolve(fallbackBase, key);
        if (fallbackPath.startsWith(fallbackBase + path.sep)) {
          try {
            return await fs.readFile(fallbackPath);
          } catch {
            // fall through
          }
        }
      }
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
      if ((error?.code === "ENOENT" || error?.code === "EROFS") && !this.baseDir.startsWith(os.tmpdir())) {
        const fallbackBase = path.join(os.tmpdir(), "payerupee_storage");
        const fallbackPath = path.resolve(fallbackBase, key);
        if (fallbackPath.startsWith(fallbackBase + path.sep)) {
          try {
            await fs.unlink(fallbackPath);
            return;
          } catch {
            // fall through
          }
        }
      }
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
      if (!this.baseDir.startsWith(os.tmpdir())) {
        const fallbackBase = path.join(os.tmpdir(), "payerupee_storage");
        const fallbackPath = path.resolve(fallbackBase, key);
        if (fallbackPath.startsWith(fallbackBase + path.sep)) {
          try {
            await fs.access(fallbackPath, fs.constants.F_OK);
            return true;
          } catch {
            // fall through
          }
        }
      }
      if (error instanceof StorageError) throw error; // Re-throw key validation errors
      return false; // Any other error (like ENOENT) means it does not exist (or isn't accessible)
    }
  }
}
