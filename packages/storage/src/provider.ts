/** A stored object's metadata, as the bucket reports it. */
export type StoredObject = {
  size: number;
  contentType: string;
};

export type UploadUrlRequest = {
  key: string;
  contentType: string;
  /** The exact byte count the PUT must carry; the storage refuses any other. */
  size: number;
  expiresInSeconds: number;
};

export type UploadUrl = {
  url: string;
  /** Headers the browser sends verbatim with the PUT: they are part of the signature. */
  headers: Record<string, string>;
  expiresAt: Date;
};

export type ReadUrlRequest = {
  key: string;
  /** Sent back as `Content-Disposition: inline`: the browser shows the file under this name. */
  fileName: string;
  expiresInSeconds: number;
};

export type ReadUrl = {
  url: string;
  expiresAt: Date;
};

/**
 * Object storage as the app uses it: the browser uploads and downloads through signed URLs, the
 * server only signs, checks and deletes (docs/adr/0012-attachments.md).
 */
export type StorageProvider = {
  createUploadUrl: (request: UploadUrlRequest) => Promise<UploadUrl>;
  createReadUrl: (request: ReadUrlRequest) => Promise<ReadUrl>;
  /** The object's metadata, or null when nothing was uploaded under the key. */
  head: (key: string) => Promise<StoredObject | null>;
  /**
   * Removes the object; resolves when it is already gone (delete jobs may repeat). Throws
   * `PermanentStorageError` when retrying cannot help (no permission, no bucket).
   */
  delete: (key: string) => Promise<void>;
};

/** A storage answer that the same request will get again: wrong credentials, a missing bucket. */
export class PermanentStorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PermanentStorageError";
  }
}

/**
 * The headers a signed PUT carries: the content type and the size, both pinned by the signature
 * (`x-goog-content-length-range` is enforced by Cloud Storage).
 */
export const uploadHeaders = (contentType: string, size: number) => ({
  "Content-Type": contentType,
  "x-goog-content-length-range": `${String(size)},${String(size)}`,
});
