import { describe, expect, it } from "vitest";

import { createMemoryStorage } from "../src/memory-storage";
import { PermanentStorageError } from "../src/provider";

describe("createMemoryStorage", () => {
  it("answers like the bucket: upload headers, head after a put, delete of a missing key", async () => {
    const storage = createMemoryStorage();
    await expect(storage.ready()).resolves.toBeUndefined();

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
      "x-goog-if-generation-match": "0",
    });

    expect(await storage.head("avatars/a.png")).toBeNull();
    storage.put("avatars/a.png", { size: 10, contentType: "image/png" });
    expect(await storage.head("avatars/a.png")).toEqual({ size: 10, contentType: "image/png" });

    const read = await storage.createReadUrl({
      key: "avatars/a.png",
      fileName: "顔.png",
      expiresInSeconds: 60,
    });
    expect(read.url).toBe("memory://read/avatars/a.png?filename=%E9%A1%94.png");

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

  it("refuses every delete permanently when asked", async () => {
    const storage = createMemoryStorage({ refuseDeletes: true });
    storage.put("resumes/r.pdf", { size: 1, contentType: "application/pdf" });

    await expect(storage.delete("resumes/r.pdf")).rejects.toBeInstanceOf(PermanentStorageError);
    expect(storage.keys()).toEqual(["resumes/r.pdf"]);
  });

  it("hands the server the bytes it reads and stores the files it writes, never twice", async () => {
    const storage = createMemoryStorage();
    const body = new TextEncoder().encode("姓,名\r\n佐藤,一郎\r\n");

    expect(await storage.download("csv-imports/a.csv")).toBeNull();
    storage.put("csv-imports/a.csv", { size: body.length, contentType: "text/csv", body });
    expect(await storage.download("csv-imports/a.csv")).toEqual(body);

    const xlsx = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    await storage.upload("csv-exports/b.xlsx", xlsx, "application/vnd.ms-excel");
    expect(await storage.head("csv-exports/b.xlsx")).toEqual({
      size: 4,
      contentType: "application/vnd.ms-excel",
    });
    expect(await storage.download("csv-exports/b.xlsx")).toEqual(xlsx);
    await expect(storage.upload("csv-exports/b.xlsx", xlsx, "text/csv")).rejects.toThrow(
      "already exists",
    );

    await storage.delete("csv-imports/a.csv");
    expect(await storage.download("csv-imports/a.csv")).toBeNull();
  });
});
