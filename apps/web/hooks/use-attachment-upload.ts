"use client";

import { useMutation } from "@tanstack/react-query";

import type { AttachmentKind } from "@repo/validation";

import { UPLOAD_FAILED, uploadRefusalOf, uploadToSignedUrl } from "@/lib/attachments";
import { useTRPC } from "@/lib/trpc/react";

/**
 * The `upload` a file field takes: asks the API for a signed URL of this kind, PUTs the file to
 * the bucket and returns the attachment id, which the form's save attaches (ADR 0012). A failure
 * is the field's message, not the global error toast: the API's own refusal when it words one
 * (`uploadRefusalOf`), ファイルのアップロードに失敗しました otherwise.
 */
export const useAttachmentUpload = (kind: AttachmentKind) => {
  const trpc = useTRPC();
  const createUploadUrl = useMutation(
    trpc.attachment.createUploadUrl.mutationOptions({ onError: () => undefined }),
  );

  return async (file: File): Promise<{ id: string }> => {
    const target = await createUploadUrl
      .mutateAsync({ kind, fileName: file.name, contentType: file.type, size: file.size })
      .catch((error: unknown) => {
        throw new Error(uploadRefusalOf(error), { cause: error });
      });
    try {
      await uploadToSignedUrl(target, file);
    } catch {
      throw new Error(UPLOAD_FAILED);
    }
    return { id: target.id };
  };
};
