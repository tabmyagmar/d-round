import { readFileSync } from "node:fs";

import { ApiError, Storage } from "@google-cloud/storage";

import { PermanentStorageError, uploadHeaders } from "./provider";
import type { StorageProvider } from "./provider";

export type GcsStorageConfig = {
  bucket: string;
  /** Path of a service-account key (JSON) outside the repository. */
  keyFile: string;
};

type ServiceAccountKey = {
  project_id?: unknown;
  client_email?: unknown;
  private_key?: unknown;
};

/** Read at start-up, so a wrong path stops the process instead of the first upload. */
const readServiceAccountKey = (keyFile: string) => {
  let key: ServiceAccountKey;
  try {
    key = JSON.parse(readFileSync(keyFile, "utf8")) as ServiceAccountKey;
  } catch {
    // No `cause`: a JSON parse error quotes part of the file, and this one holds a private key.
    throw new Error(`GCS_KEY_FILE ${keyFile} is not a readable JSON file`);
  }
  if (
    typeof key.project_id !== "string" ||
    typeof key.client_email !== "string" ||
    typeof key.private_key !== "string"
  ) {
    throw new Error(`GCS_KEY_FILE ${keyFile} is not a service-account key`);
  }
  return {
    projectId: key.project_id,
    credentials: { client_email: key.client_email, private_key: key.private_key },
  };
};

/** RFC 6266: an ASCII fallback plus the UTF-8 name, so Japanese names survive every browser. */
const inlineDisposition = (fileName: string) => {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

/**
 * Google Cloud Storage with V4 signed URLs. Signing uses the key's private key locally, so a URL
 * costs no request; `head` and `delete` call the JSON API.
 */
export const createGcsStorage = ({ bucket: bucketName, keyFile }: GcsStorageConfig) => {
  const bucket = new Storage(readServiceAccountKey(keyFile)).bucket(bucketName);
  const expiry = (seconds: number) => Date.now() + seconds * 1000;

  const provider: StorageProvider = {
    // Listing one object needs only `storage.objects.list` (roles/storage.objectAdmin has it);
    // reading the bucket's metadata would need a bucket role. A missing bucket answers 404.
    ready: async () => {
      try {
        await bucket.getFiles({ maxResults: 1, autoPaginate: false });
      } catch (error) {
        throw new Error(`GCS_BUCKET ${bucketName} cannot be read with GCS_KEY_FILE`, {
          cause: error,
        });
      }
    },

    createUploadUrl: async ({ key, contentType, size, expiresInSeconds }) => {
      const expires = expiry(expiresInSeconds);
      const { "Content-Type": _contentType, ...extensionHeaders } = uploadHeaders(
        contentType,
        size,
      );
      const [url] = await bucket.file(key).getSignedUrl({
        version: "v4",
        action: "write",
        expires,
        contentType,
        extensionHeaders,
      });
      const headers = uploadHeaders(contentType, size);
      return { url, headers, expiresAt: new Date(expires) };
    },

    createReadUrl: async ({ key, fileName, expiresInSeconds }) => {
      const expires = expiry(expiresInSeconds);
      const [url] = await bucket.file(key).getSignedUrl({
        version: "v4",
        action: "read",
        expires,
        responseDisposition: inlineDisposition(fileName),
      });
      return { url, expiresAt: new Date(expires) };
    },

    head: async (key) => {
      try {
        const [metadata] = await bucket.file(key).getMetadata();
        return { size: Number(metadata.size), contentType: metadata.contentType ?? "" };
      } catch (error) {
        if (error instanceof ApiError && error.code === 404) {
          return null;
        }
        throw error;
      }
    },

    delete: async (key) => {
      try {
        await bucket.file(key).delete({ ignoreNotFound: true });
      } catch (error) {
        // 400 / 401 / 403: the request, the key or its role is wrong — every retry fails the same.
        // A missing bucket answers 404, which `ignoreNotFound` treats as done: `ready()` at
        // start-up rules out a wrong bucket; one deleted while running is not noticed
        // (docs/attachments.md). A key the token endpoint refuses (revoked) fails before this
        // call, not as an ApiError: it is retried.
        if (error instanceof ApiError && [400, 401, 403].includes(error.code ?? 0)) {
          throw new PermanentStorageError(`Cloud Storage refused the delete of ${key}`, {
            cause: error,
          });
        }
        throw error;
      }
    },

    download: async (key) => {
      try {
        const [contents] = await bucket.file(key).download();
        return new Uint8Array(contents);
      } catch (error) {
        if (error instanceof ApiError && error.code === 404) {
          return null;
        }
        throw error;
      }
    },

    // Create-only, as the signed uploads (`ifGenerationMatch: 0`): a key is never written twice.
    upload: async (key, body, contentType) => {
      await bucket.file(key).save(Buffer.from(body), {
        contentType,
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    },
  };
  return provider;
};
