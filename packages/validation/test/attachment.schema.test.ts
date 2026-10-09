import { describe, expect, it } from "vitest";

import {
  ATTACHMENT_RULES,
  attachmentAccept,
  createUploadUrlSchema,
  fileExtension,
  sanitizeFileName,
} from "../src/attachment.schema";

const pdf = {
  kind: "STAFF_RESUME",
  fileName: "履歴書.pdf",
  contentType: "application/pdf",
  size: 1024,
};

const messagesOf = (input: unknown): string[] => {
  const result = createUploadUrlSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("sanitizeFileName", () => {
  it("drops the path, control characters and spaces and lower-cases the extension", () => {
    expect(sanitizeFileName("  C:\\Users\\me\\履歴書.PDF ")).toBe("履歴書.pdf");
    expect(sanitizeFileName("../../etc/pass\u0000wd.Png")).toBe("passwd.png");
    expect(sanitizeFileName("README")).toBe("README");
    expect(sanitizeFileName(".env")).toBe(".env");
  });

  it("reads the extension after the last dot only when there is a name before it", () => {
    expect(fileExtension("a.tar.GZ")).toBe(".gz");
    expect(fileExtension(".env")).toBe("");
    expect(fileExtension("noext")).toBe("");
  });
});

describe("createUploadUrlSchema", () => {
  it("accepts a file of the kind's types within its size and stores the clean name", () => {
    expect(createUploadUrlSchema.parse({ ...pdf, fileName: "dir/履歴書.PDF" })).toEqual({
      ...pdf,
      fileName: "履歴書.pdf",
    });
    expect(
      createUploadUrlSchema.safeParse({
        kind: "USER_AVATAR",
        fileName: "face.JPEG",
        contentType: "image/jpeg",
        size: ATTACHMENT_RULES.USER_AVATAR.maxBytes,
      }).success,
    ).toBe(true);
  });

  it("refuses another type, an extension that does not match the type, and a size over the limit", () => {
    expect(messagesOf({ ...pdf, contentType: "image/png" })).toEqual([
      "この形式のファイルは選択できません",
    ]);
    expect(messagesOf({ ...pdf, fileName: "resume.exe" })).toEqual([
      "この形式のファイルは選択できません",
    ]);
    expect(messagesOf({ ...pdf, size: 5 * 1024 * 1024 + 1 })).toEqual([
      "5MB以下のファイルを選択してください",
    ]);
    expect(messagesOf({ ...pdf, size: 0 })).toEqual(["空のファイルは選択できません"]);
    expect(messagesOf({ ...pdf, fileName: " / " })).toContain("ファイル名がありません");
    expect(createUploadUrlSchema.safeParse({ ...pdf, kind: "CLIENT_IMAGE" }).success).toBe(false);
  });

  it("gives the form its accept list", () => {
    expect(attachmentAccept("USER_AVATAR")).toBe("image/jpeg,image/png,image/webp");
    expect(attachmentAccept("STAFF_RESUME")).toBe("application/pdf");
  });
});
