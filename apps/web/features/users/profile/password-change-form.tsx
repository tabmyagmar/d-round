"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { FieldGroup } from "@repo/ui/components/field";
import { PasswordField } from "@repo/ui/components/form";
import { changePasswordSchema } from "@repo/validation";
import type { ChangePasswordInput } from "@repo/validation";

import { authErrorMessage } from "@/features/auth/auth-errors";
import { authClient } from "@/lib/auth/client";

const EMPTY: ChangePasswordInput = { currentPassword: "", newPassword: "", confirmPassword: "" };

/**
 * Changes the signed-in user's own password through Better Auth. Other sessions end on success
 * (`revokeOtherSessions`); this browser stays signed in. The API applies the same policy.
 */
export const PasswordChangeForm = () => {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    setServerError(null);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      setServerError(authErrorMessage(error));
      return;
    }
    toast.success("パスワードを変更しました");
    form.reset(EMPTY);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FieldGroup>
        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}
        <PasswordField
          control={form.control}
          name="currentPassword"
          label="現在のパスワード"
          autoComplete="current-password"
        />
        <PasswordField
          control={form.control}
          name="newPassword"
          label="新しいパスワード"
          description="8文字以上で、英字と数字をそれぞれ1文字以上含めてください。"
          autoComplete="new-password"
        />
        <PasswordField
          control={form.control}
          name="confirmPassword"
          label="新しいパスワード（確認）"
          autoComplete="new-password"
        />
      </FieldGroup>
      <div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "変更中…" : "パスワードを変更"}
        </Button>
      </div>
    </form>
  );
};
