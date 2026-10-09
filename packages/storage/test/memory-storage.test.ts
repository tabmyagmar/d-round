import { describe, expect, it } from "vitest";

import { createMemoryStorage } from "../src/memory-storage";

describe("createMemoryStorage", () => {
  it("answers like the bucket: upload headers, head after a put, delete of a missing key", async () => {
    const storage = createMemoryStorage();

    const upload = await storage.createUploadUrl({
      key: "avatars/a.png",
      contentType: "image/png",
      size: 10,
      expiresInSeconds: 60,
    });
    expect(upload.url).toBe("memory://upload/avatars/a.png");
    expect(upload.headers).toEqual({
      "Content-Type": "image/png",
      "x-goog-content-length-range": "10,10",
    });

    expect(await storage.head("avatars/a.png")).toBeNull();
    storage.put("avatars/a.png", { size: 10, contentType: "image/png" });
    expect(await storage.head("avatars/a.png")).toEqual({ size: 10, contentType: "image/png" });

    const read = await storage.createReadUrl({
      key: "avatars/a.png",
      fileName: "顔.png",
      disposition: "inline",
      expiresInSeconds: 60,
    });
    expect(read.url).toBe("memory://read/avatars/a.png?disposition=inline&filename=%E9%A1%94.png");

    await storage.delete("avatars/a.png");
    await storage.delete("avatars/a.png");
    expect(storage.keys()).toEqual([]);
  });

  it("fails the first deletes when asked, then deletes", async () => {
    const storage = createMemoryStorage({ failFirstDeletes: 1 });
    storage.put("resumes/r.pdf", { size: 1, contentType: "application/pdf" });

    await expect(storage.delete("resumes/r.pdf")).rejects.toThrow(/storage unavailable/);
    expect(storage.keys()).toEqual(["resumes/r.pdf"]);
    await storage.delete("resumes/r.pdf");
    expect(storage.keys()).toEqual([]);
  });
});
