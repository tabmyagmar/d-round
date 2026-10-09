import { afterEach, describe, expect, it, vi } from "vitest";

import {
  UPLOAD_FAILED,
  toAttachmentValue,
  uploadRefusalOf,
  uploadToSignedUrl,
} from "@/lib/attachments";

const target = {
  id: "0199a1b2-0000-7000-8000-000000000001",
  url: "https://storage.googleapis.com/d-round-dev/avatars/a.png?X-Goog-Signature=s",
  headers: { "Content-Type": "image/png", "x-goog-content-length-range": "3,3" },
  expiresAt: new Date(),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadToSignedUrl", () => {
  it("PUTs the file with exactly the signed headers", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["png"], "a.png", { type: "image/png" });

    await uploadToSignedUrl(target, file);

    expect(fetchMock).toHaveBeenCalledWith(target.url, {
      method: "PUT",
      headers: target.headers,
      body: file,
    });
  });

  it("fails when the bucket refuses the file", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("EntityTooSmall", { status: 400 })));

    await expect(uploadToSignedUrl(target, new File(["x"], "a.png"))).rejects.toThrow(
      UPLOAD_FAILED,
    );
  });
});

describe("toAttachmentValue", () => {
  it("turns a stored file into the value the file fields hold", () => {
    expect(
      toAttachmentValue({
        id: target.id,
        fileName: "履歴書.pdf",
        contentType: "application/pdf",
        size: 1024,
        url: "https://read",
      }),
    ).toEqual({
      id: target.id,
      name: "履歴書.pdf",
      size: 1024,
      type: "application/pdf",
      url: "https://read",
    });
  });
});

describe("uploadRefusalOf", () => {
  it("passes on a refusal the API words for the user and hides everything else", () => {
    const tooMany = "アップロード中のファイルが多すぎます。保存してから、もう一度お試しください";

    expect(uploadRefusalOf({ message: tooMany, data: { code: "BAD_REQUEST" } })).toBe(tooMany);
    expect(
      uploadRefusalOf({
        message: '[{"code":"custom","path":["size"]}]',
        data: { code: "BAD_REQUEST" },
      }),
    ).toBe(UPLOAD_FAILED);
    expect(uploadRefusalOf({ message: "Not allowed", data: { code: "FORBIDDEN" } })).toBe(
      UPLOAD_FAILED,
    );
    expect(uploadRefusalOf(new TypeError("Failed to fetch"))).toBe(UPLOAD_FAILED);
    expect(uploadRefusalOf(undefined)).toBe(UPLOAD_FAILED);
  });
});
