import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";
import type { AttachmentValue } from "@repo/validation";

/** `attachment.createUploadUrl`: where and how the browser PUTs the file (ADR 0012). */
export type UploadTarget = inferRouterOutputs<AppRouter>["attachment"]["createUploadUrl"];

/** A stored file as the owners' reads return it (`user.byId` avatar, `staff.byId` resumes). */
export type AttachmentView = NonNullable<inferRouterOutputs<AppRouter>["user"]["byId"]["avatar"]>;

export const UPLOAD_FAILED = "ファイルのアップロードに失敗しました";

/**
 * What to tell the user when the API refuses an upload URL: its own sentence for a refusal it
 * words for people (BAD_REQUEST from a service: too many uploads waiting), `UPLOAD_FAILED` for the
 * rest. An input error's message is zod's issue list as JSON, which says nothing to a user.
 */
export const uploadRefusalOf = (error: unknown): string => {
  const { message, data } = (error ?? {}) as { message?: unknown; data?: { code?: unknown } };
  return data?.code === "BAD_REQUEST" && typeof message === "string" && !message.startsWith("[")
    ? message
    : UPLOAD_FAILED;
};

/**
 * Sends the file to the signed URL with the headers the signature covers; the bucket refuses
 * another type or size. Throws `UPLOAD_FAILED` when the bucket answers with an error.
 */
export const uploadToSignedUrl = async (target: UploadTarget, file: File): Promise<void> => {
  const response = await fetch(target.url, { method: "PUT", headers: target.headers, body: file });
  if (!response.ok) {
    throw new Error(UPLOAD_FAILED);
  }
};

/** A stored file as `FileField` / `AvatarField` hold it, so the forms start from what is saved. */
export const toAttachmentValue = (view: AttachmentView): AttachmentValue => ({
  id: view.id,
  name: view.fileName,
  size: view.size,
  type: view.contentType,
  url: view.url,
});
