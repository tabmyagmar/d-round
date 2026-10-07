"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/button";
import { FieldGroup } from "@repo/ui/components/field";
import { updateProfileSchema } from "@repo/validation";
import type { UpdateProfileInput } from "@repo/validation";

import { UserNameFields } from "@/features/users/components/form/user-form-fields";
import type { NamePart } from "@/features/users/utils/user-form-input";
import { useTRPC } from "@/lib/trpc/react";

export type ProfileFormProps = {
  /** The stored name parts; a user from before the parts has none and is asked for them. */
  initial: Record<NamePart, string | null>;
  disabled?: boolean;
};

/** /admin/profile: one's own 姓 / 名 / セイ / メイ (`user.updateProfile`, the API's schema). */
export const ProfileForm = ({ initial, disabled = false }: ProfileFormProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      lastName: initial.lastName ?? "",
      firstName: initial.firstName ?? "",
      lastNameKana: initial.lastNameKana ?? "",
      firstNameKana: initial.firstNameKana ?? "",
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
        update.mutate(values);
      })}
      noValidate
      className="flex flex-col gap-4"
    >
      <FieldGroup>
        <UserNameFields control={form.control} disabled={disabled} />
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
