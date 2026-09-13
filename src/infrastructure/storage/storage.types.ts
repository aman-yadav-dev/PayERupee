/**
 * Provider-neutral storage interface.
 */
export interface IStorageProvider {
  /**
   * Writes binary data to the storage provider.
   * @param key Opaque storage key (e.g. UUID)
   * @param data Binary buffer
   * @param mimeType Optional MIME type for providers that support it
   */
  put(key: string, data: Buffer, mimeType?: string): Promise<void>;

  /**
   * Reads binary data from the storage provider.
   * @param key Opaque storage key
   * @returns Binary buffer
   */
  get(key: string): Promise<Buffer>;

  /**
   * Deletes a file from the storage provider.
   * @param key Opaque storage key
   */
  delete(key: string): Promise<void>;

  /**
   * Checks if a file exists.
   * @param key Opaque storage key
   */
  exists(key: string): Promise<boolean>;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export class StorageKeyError extends StorageError {
  constructor(message: string = "Invalid storage key") {
    super(message);
    this.name = "StorageKeyError";
  }
}

export class StorageNotFoundError extends StorageError {
  constructor(message: string = "Object not found") {
    super(message);
    this.name = "StorageNotFoundError";
  }
}
