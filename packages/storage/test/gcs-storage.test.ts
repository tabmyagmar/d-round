import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { createGcsStorage } from "../src/gcs-storage";

// Signing is local (the key's private key), so these tests need no network and no bucket. The
// head / delete calls go to the JSON API and are covered by the smoke check (docs/attachments.md).
let keyFile: string;

beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  keyFile = join(mkdtempSync(join(tmpdir(), "gcs-key-")), "key.json");
  writeFileSync(
    keyFile,
    JSON.stringify({
      type: "service_account",
      project_id: "test-project",
      client_email: "signer@test-project.iam.gserviceaccount.com",
      private_key: privateKey,
    }),
  );
});

describe("createGcsStorage", () => {
  it("signs a V4 PUT that pins the content type and the exact size", async () => {
    const storage = createGcsStorage({ bucket: "d-round-test", keyFile });
    const before = Date.now();

    const upload = await storage.createUploadUrl({
      key: "resumes/3f2c.pdf",
      contentType: "application/pdf",
      size: 1234,
      expiresInSeconds: 900,
    });

    const url = new URL(upload.url);
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://storage.googleapis.com/d-round-test/resumes/3f2c.pdf",
    );
    expect(url.searchParams.get("X-Goog-Algorithm")).toBe("GOOG4-RSA-SHA256");
    expect(url.searchParams.get("X-Goog-Credential")).toMatch(
      /^signer@test-project\.iam\.gserviceaccount\.com\//,
    );
    expect(Number(url.searchParams.get("X-Goog-Expires"))).toBeGreaterThanOrEqual(899);
    expect(url.searchParams.get("X-Goog-SignedHeaders")).toBe(
      "content-type;host;x-goog-content-length-range",
    );
    expect(upload.headers).toEqual({
      "Content-Type": "application/pdf",
      "x-goog-content-length-range": "1234,1234",
    });
    expect(upload.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 900_000);
  });

  it("signs a GET that names the file in Content-Disposition, Japanese names included", async () => {
    const storage = createGcsStorage({ bucket: "d-round-test", keyFile });

    const read = await storage.createReadUrl({
      key: "resumes/3f2c.pdf",
      fileName: "履歴書 (1).pdf",
      disposition: "attachment",
      expiresInSeconds: 900,
    });

    const url = new URL(read.url);
    expect(url.searchParams.get("X-Goog-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("response-content-disposition")).toBe(
      "attachment; filename=\"___ (1).pdf\"; filename*=UTF-8''%E5%B1%A5%E6%AD%B4%E6%9B%B8%20%281%29.pdf",
    );
  });

  it("refuses to start without a readable service-account key", () => {
    expect(() => createGcsStorage({ bucket: "b", keyFile: "/nonexistent/key.json" })).toThrow(
      /GCS_KEY_FILE \/nonexistent\/key\.json is not a readable JSON file/,
    );
    const notAKey = join(mkdtempSync(join(tmpdir(), "gcs-key-")), "key.json");
    writeFileSync(notAKey, JSON.stringify({ type: "authorized_user" }));
    expect(() => createGcsStorage({ bucket: "b", keyFile: notAKey })).toThrow(
      /is not a service-account key/,
    );
  });
});
