import { z } from "zod";

/**
 * What a file is for (docs/adr/0012-attachments.md). The kind fixes the owner, the accepted types,
 * the size limit and the bucket folder below; the database enum `AttachmentKind` matches.
 */
export const ATTACHMENT_KINDS = ["USER_AVATAR", "STAFF_RESUME"] as const;
export const attachmentKindSchema = z.enum(ATTACHMENT_KINDS);
export type AttachmentKind = z.infer<typeof attachmentKindSchema>;

export type AttachmentRule = {
  /** Accepted content types and the extensions a file of each type may carry. */
  types: Readonly<Record<string, readonly string[]>>;
  maxBytes: number;
  /** Files one owner keeps of this kind. */
  maxFiles: number;
  /** Bucket folder: objects are `<folder>/<random uuid><.ext>`. */
  folder: string;
};

const MB = 1024 * 1024;

/** The legacy limits: images for the プロフィール画像, up to three PDFs for the 履歴書, 5 MB each. */
export const ATTACHMENT_RULES: Readonly<Record<AttachmentKind, AttachmentRule>> = {
  USER_AVATAR: {
    types: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] },
    maxBytes: 5 * MB,
    maxFiles: 1,
    folder: "avatars",
  },
  STAFF_RESUME: {
    types: { "application/pdf": [".pdf"] },
    maxBytes: 5 * MB,
    maxFiles: 3,
    folder: "resumes",
  },
};

/** Upload and read URLs live this long (the legacy's 15 minutes). */
export const ATTACHMENT_URL_TTL_SECONDS = 15 * 60;

/** `<input accept>` for a kind: its content types. */
export const attachmentAccept = (kind: AttachmentKind): string =>
  Object.keys(ATTACHMENT_RULES[kind].types).join(",");

/** The extension with its dot, lower-cased (`.pdf`), or "" when the name has none. */
export const fileExtension = (fileName: string): string => {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot).toLowerCase() : "";
};

/** C0 and C1 controls, DEL, and the direction marks, embeddings, overrides and isolates. */
const UNSAFE_NAME_CHARACTERS =
  // eslint-disable-next-line no-control-regex -- control characters are exactly what goes
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * The picked name as shown and stored: no path, no control or direction-override characters (a
 * right-to-left override can make `exe.pdf` read as `fdp.exe`), no surrounding spaces, the
 * extension lower-cased (the legacy `renameFileExtensionLowercase`).
 */
export const sanitizeFileName = (raw: string): string => {
  const base = raw.split(/[/\\]/).pop() ?? "";
  const clean = base.replace(UNSAFE_NAME_CHARACTERS, "").trim();
  const extension = fileExtension(clean);
  return extension ? `${clean.slice(0, -extension.length)}${extension}` : clean;
};

/** One file the browser is about to upload: the API checks it against the kind's rule. */
export const createUploadUrlSchema = z
  .object({
    kind: attachmentKindSchema,
    fileName: z
      .string()
      .transform(sanitizeFileName)
      .pipe(
        z
          .string()
          .min(1, { error: "ファイル名がありません" })
          .max(255, { error: "ファイル名は255文字以内にしてください" }),
      ),
    contentType: z.string().max(100),
    size: z.int().positive({ error: "空のファイルは選択できません" }),
  })
  .superRefine((input, context) => {
    const rule = ATTACHMENT_RULES[input.kind];
    // Own keys only: "toString" or "__proto__" must be refused, not looked up on the prototype.
    const extensions = Object.hasOwn(rule.types, input.contentType)
      ? rule.types[input.contentType]
      : undefined;
    if (!extensions?.includes(fileExtension(input.fileName))) {
      context.addIssue({
        code: "custom",
        path: ["contentType"],
        message: "この形式のファイルは選択できません",
      });
    }
    if (input.size > rule.maxBytes) {
      context.addIssue({
        code: "custom",
        path: ["size"],
        message: `${String(rule.maxBytes / MB)}MB以下のファイルを選択してください`,
      });
    }
  });
export type CreateUploadUrlInput = z.infer<typeof createUploadUrlSchema>;

/**
 * A file a form holds (`FileFieldValue` of @repo/ui) once its upload finished: the attachment id
 * is what the API receives. An entry still uploading has no id and stops the submit here.
 */
export const attachmentValueSchema = z.object({
  id: z.uuid({ error: "アップロードが完了するまでお待ちください" }),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string().optional(),
});
export type AttachmentValue = z.infer<typeof attachmentValueSchema>;
