"use client";

import { useMutation } from "@tanstack/react-query";

import type { AttachmentKind } from "@repo/validation";

import { UPLOAD_FAILED, uploadToSignedUrl } from "@/lib/attachments";
import { useTRPC } from "@/lib/trpc/react";

/**
 * The `upload` a file field takes: asks the API for a signed URL of this kind, PUTs the file to
 * the bucket and returns the attachment id, which the form's save attaches (ADR 0012). A failure
 * is the field's message, not the global error toast.
 */
export const useAttachmentUpload = (kind: AttachmentKind) => {
  const trpc = useTRPC();
  const createUploadUrl = useMutation(
    trpc.attachment.createUploadUrl.mutationOptions({ onError: () => undefined }),
  );

  return async (file: File): Promise<{ id: string }> => {
    try {
      const target = await createUploadUrl.mutateAsync({
        kind,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      });
      await uploadToSignedUrl(target, file);
      return { id: target.id };
    } catch {
      throw new Error(UPLOAD_FAILED);
    }
  };
};
