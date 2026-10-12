"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/button";
import { FieldGroup } from "@repo/ui/components/field";
import { AvatarField } from "@repo/ui/components/form";
import { ATTACHMENT_RULES, attachmentAccept, profileFormSchema } from "@repo/validation";
import type { AttachmentValue, ProfileFormInput } from "@repo/validation";

import { NameFields } from "@/components/name-fields";
import { toProfileInput } from "@/features/users/utils/user-form-input";
import type { NamePart } from "@/features/users/utils/user-form-input";
import { useTRPC } from "@/lib/trpc/react";

export type ProfileFormProps = {
  /** The stored name parts; a user from before the parts has none and is asked for them. */
  initial: Record<NamePart, string | null>;
  /** The stored プロフィール画像, or null. */
  avatar: AttachmentValue | null;
  /** Uploads a picked image (`useAttachmentUpload("USER_AVATAR")` in the container). */
  uploadAvatar: (file: File) => Promise<{ id: string }>;
  disabled?: boolean;
};

/**
 * /admin/profile: one's own プロフィール画像 and 姓 / 名 / セイ / メイ (`user.updateProfile`; legacy
 * `ProfileEdit`: the round image above the names). The image is uploaded when picked and saved
 * with 保存.
 */
export const ProfileForm = ({
  initial,
  avatar,
  uploadAvatar,
  disabled = false,
}: ProfileFormProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const form = useForm<ProfileFormInput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      lastName: initial.lastName ?? "",
      firstName: initial.firstName ?? "",
      lastNameKana: initial.lastNameKana ?? "",
      firstNameKana: initial.firstNameKana ?? "",
      avatar,
    },
  });

  const update = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: async () => {
        toast.success("プロフィールを保存しました");
        await queryClient.invalidateQueries(trpc.user.pathFilter());
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        update.mutate(toProfileInput(values, avatar?.id ?? null));
      })}
      noValidate
      className="flex flex-col gap-4"
    >
      <FieldGroup>
        <AvatarField
          control={form.control}
          name="avatar"
          label="プロフィール画像"
          accept={attachmentAccept("USER_AVATAR")}
          maxSize={ATTACHMENT_RULES.USER_AVATAR.maxBytes}
          upload={uploadAvatar}
          size={96}
          disabled={disabled}
        />
        <NameFields control={form.control} disabled={disabled} />
      </FieldGroup>
      {disabled ? null : (
        <div>
          <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
            {update.isPending ? "保存中…" : "保存"}
          </Button>
        </div>
      )}
    </form>
  );
};
