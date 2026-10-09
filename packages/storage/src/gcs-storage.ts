import { readFileSync } from "node:fs";

import { ApiError, Storage } from "@google-cloud/storage";

import { uploadHeaders } from "./provider";
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
  } catch (error) {
    throw new Error(`GCS_KEY_FILE ${keyFile} is not a readable JSON file`, { cause: error });
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
const contentDisposition = (disposition: "inline" | "attachment", fileName: string) => {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

/**
 * Google Cloud Storage with V4 signed URLs. Signing uses the key's private key locally, so a URL
 * costs no request; `head` and `delete` call the JSON API.
 */
export const createGcsStorage = ({ bucket: bucketName, keyFile }: GcsStorageConfig) => {
  const bucket = new Storage(readServiceAccountKey(keyFile)).bucket(bucketName);
  const expiry = (seconds: number) => Date.now() + seconds * 1000;

  const provider: StorageProvider = {
    createUploadUrl: async ({ key, contentType, size, expiresInSeconds }) => {
      const expires = expiry(expiresInSeconds);
      const headers = uploadHeaders(contentType, size);
      const [url] = await bucket.file(key).getSignedUrl({
        version: "v4",
        action: "write",
        expires,
        contentType,
        extensionHeaders: {
          "x-goog-content-length-range": headers["x-goog-content-length-range"],
        },
      });
      return { url, headers, expiresAt: new Date(expires) };
    },

    createReadUrl: async ({ key, fileName, disposition, expiresInSeconds }) => {
      const expires = expiry(expiresInSeconds);
      const [url] = await bucket.file(key).getSignedUrl({
        version: "v4",
        action: "read",
        expires,
        responseDisposition: contentDisposition(disposition, fileName),
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
      await bucket.file(key).delete({ ignoreNotFound: true });
    },
  };
  return provider;
};
