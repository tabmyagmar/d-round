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
 * server signs, checks and deletes (docs/adr/0012-attachments.md), and reads or writes the small
 * files it processes itself — a CSV import's file, a CSV export (docs/adr/0013-csv-import.md).
 */
export type StorageProvider = {
  /**
   * Resolves when the bucket answers; called once at start-up, so a wrong or missing bucket stops
   * the process instead of turning every delete into a silent 404.
   */
  ready: () => Promise<void>;
  createUploadUrl: (request: UploadUrlRequest) => Promise<UploadUrl>;
  createReadUrl: (request: ReadUrlRequest) => Promise<ReadUrl>;
  /** The object's metadata, or null when nothing was uploaded under the key. */
  head: (key: string) => Promise<StoredObject | null>;
  /**
   * Removes the object; resolves when it is already gone (delete jobs may repeat). Throws
   * `PermanentStorageError` when retrying cannot help (the bucket answered 400 / 401 / 403).
   */
  delete: (key: string) => Promise<void>;
  /** The object's bytes, or null when nothing was uploaded under the key. Small files only. */
  download: (key: string) => Promise<Uint8Array | null>;
  /** Stores bytes the server produced under a new key; never overwrites an existing object. */
  upload: (key: string, body: Uint8Array, contentType: string) => Promise<void>;
};

/** A storage answer the same request will get again: a refused key or role (400 / 401 / 403). */
export class PermanentStorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PermanentStorageError";
  }
}

/**
 * The headers a signed PUT carries, all pinned by the signature: the content type, the exact size
 * (`x-goog-content-length-range`) and create-only (`x-goog-if-generation-match: 0`, so a URL can
 * never overwrite an object, 412). Cloud Storage enforces each.
 */
export const uploadHeaders = (contentType: string, size: number) => ({
  "Content-Type": contentType,
  "x-goog-content-length-range": `${String(size)},${String(size)}`,
  "x-goog-if-generation-match": "0",
});
