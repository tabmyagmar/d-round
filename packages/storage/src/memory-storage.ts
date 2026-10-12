import { PermanentStorageError, uploadHeaders } from "./provider";
import type { StorageProvider, StoredObject } from "./provider";

export type MemoryStorageOptions = {
  /** Reject the first N deletes with a retryable error (a transient Cloud Storage failure). */
  failFirstDeletes?: number;
  /** Reject every delete with a `PermanentStorageError` (a key without the bucket role). */
  refuseDeletes?: boolean;
};

export type MemoryStorage = StorageProvider & {
  /** Stores what the browser's signed PUT would have stored; `body` for files the server reads. */
  put: (key: string, object: StoredObject & { body?: Uint8Array }) => void;
  /** The keys stored right now. */
  keys: () => string[];
};

/** Test double for the bucket — an external provider, the only kind of thing tests may fake. */
export const createMemoryStorage = (options: MemoryStorageOptions = {}): MemoryStorage => {
  const objects = new Map<string, StoredObject>();
  const bodies = new Map<string, Uint8Array>();
  const state = { deletes: 0 };
  const expiresAt = (seconds: number) => new Date(Date.now() + seconds * 1000);

  return {
    ready: () => Promise.resolve(),
    put: (key, { body, ...object }) => {
      objects.set(key, object);
      if (body) {
        bodies.set(key, body);
      }
    },
    keys: () => [...objects.keys()],

    createUploadUrl: ({ key, contentType, size, expiresInSeconds }) =>
      Promise.resolve({
        url: `memory://upload/${key}`,
        headers: uploadHeaders(contentType, size),
        expiresAt: expiresAt(expiresInSeconds),
      }),

    createReadUrl: ({ key, fileName, expiresInSeconds }) =>
      Promise.resolve({
        url: `memory://read/${key}?filename=${encodeURIComponent(fileName)}`,
        expiresAt: expiresAt(expiresInSeconds),
      }),

    head: (key) => Promise.resolve(objects.get(key) ?? null),

    delete: (key) => {
      state.deletes += 1;
      if (options.refuseDeletes) {
        return Promise.reject(new PermanentStorageError(`storage refused the delete of ${key}`));
      }
      if (options.failFirstDeletes !== undefined && state.deletes <= options.failFirstDeletes) {
        return Promise.reject(new Error(`storage unavailable (delete ${String(state.deletes)})`));
      }
      objects.delete(key);
      bodies.delete(key);
      return Promise.resolve();
    },

    download: (key) =>
      Promise.resolve(objects.has(key) ? (bodies.get(key) ?? new Uint8Array()) : null),

    upload: (key, body, contentType) => {
      if (objects.has(key)) {
        return Promise.reject(new Error(`an object already exists under ${key}`));
      }
      objects.set(key, { size: body.length, contentType });
      bodies.set(key, body);
      return Promise.resolve();
    },
  };
};
