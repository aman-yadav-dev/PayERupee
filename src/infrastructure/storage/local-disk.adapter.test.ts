import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { LocalDiskStorageAdapter } from "./local-disk.adapter";
import { StorageKeyError, StorageNotFoundError, StorageError } from "./storage.types";

describe("LocalDiskStorageAdapter", () => {
  let tempDir: string;
  let adapter: LocalDiskStorageAdapter;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "payerupee-storage-test-"));
    adapter = new LocalDiskStorageAdapter(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("1, 2, 3: writes, reads, and preserves binary content exactly", async () => {
    const key = "test-doc.pdf";
    // Dummy PDF binary-like buffer
    const data = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25]);
    
    await adapter.put(key, data);
    const result = await adapter.get(key);
    
    expect(result).toBeInstanceOf(Buffer);
    expect(result.equals(data)).toBe(true);
  });

  it("4, 5: checks existence and deletes file", async () => {
    const key = "temp.txt";
    await adapter.put(key, Buffer.from("hello"));
    
    expect(await adapter.exists(key)).toBe(true);
    
    await adapter.delete(key);
    
    expect(await adapter.exists(key)).toBe(false);
  });

  it("6: missing file throws StorageNotFoundError on get", async () => {
    await expect(adapter.get("does-not-exist.txt")).rejects.toThrow(StorageNotFoundError);
  });

  it("7: invalid storage keys are rejected", async () => {
    await expect(adapter.put("", Buffer.from("data"))).rejects.toThrow(StorageKeyError);
    // @ts-ignore
    await expect(adapter.put(null, Buffer.from("data"))).rejects.toThrow(StorageKeyError);
    await expect(adapter.put("bad\0key", Buffer.from("data"))).rejects.toThrow(StorageKeyError);
  });

  it("8: directory traversal (../) is rejected", async () => {
    await expect(adapter.put("../outside.txt", Buffer.from("hack"))).rejects.toThrow(StorageKeyError);
    await expect(adapter.get("../../etc/passwd")).rejects.toThrow(StorageKeyError);
    await expect(adapter.delete("safe/../../unsafe.txt")).rejects.toThrow(StorageKeyError);
  });

  it("9: absolute paths are rejected", async () => {
    const absolutePath = path.resolve(tempDir, "absolute.txt");
    await expect(adapter.put(absolutePath, Buffer.from("hack"))).rejects.toThrow(StorageKeyError);
    await expect(adapter.put("/etc/shadow", Buffer.from("hack"))).rejects.toThrow(StorageKeyError);
    await expect(adapter.put("C:\\Windows\\System32\\cmd.exe", Buffer.from("hack"))).rejects.toThrow(StorageKeyError);
  });

  it("10, 11: nested safe storage key works and remains inside root", async () => {
    const key = "users/123/docs/id.jpg";
    await adapter.put(key, Buffer.from("image data"));
    
    expect(await adapter.exists(key)).toBe(true);
    
    // Verify physical file is exactly where expected inside tempDir
    const physicalContent = await fs.readFile(path.join(tempDir, "users", "123", "docs", "id.jpg"));
    expect(physicalContent.toString()).toBe("image data");
  });

  it("12: failed operations do not leak absolute filesystem paths", async () => {
    // Attempting to read a non-existent file shouldn't leak the tempDir path
    try {
      await adapter.get("missing.txt");
      expect.fail("Should have thrown");
    } catch (err: any) {
      if (err.name === "AssertionError") throw err;
      expect(err).toBeInstanceOf(StorageNotFoundError);
      expect(err.message).not.toContain(tempDir);
    }

    // Force an unexpected error by creating a directory where a file is expected
    await fs.mkdir(path.join(tempDir, "dir-conflict"));
    
    try {
      await adapter.put("dir-conflict", Buffer.from("data"));
      expect.fail("Should have thrown");
    } catch (err: any) {
      if (err.name === "AssertionError") throw err; // Re-throw if expect.fail triggered
      expect(err).toBeInstanceOf(StorageError);
      expect(err.message).toBe("Storage write operation failed"); // Generic, non-leaking message
      expect(err.message).not.toContain(tempDir);
    }
  });
});
