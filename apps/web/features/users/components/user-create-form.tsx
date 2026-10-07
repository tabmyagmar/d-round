"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { TextField } from "@repo/ui/components/form";
import { DEFAULT_ROLE, inviteUserFormSchema } from "@repo/validation";
import type { InviteUserFormInput, InviteUserInput } from "@repo/validation";

import { href, routes } from "@/config/routes";
import { UserFormFields } from "@/features/users/components/user-form-fields";
import type { RoleFieldState } from "@/features/users/utils/role-field-state";
import { toInviteInput } from "@/features/users/utils/user-form-input";

export type UserCreateFormProps = {
  roleField: RoleFieldState;
  canEditPermissions: boolean;
  pending: boolean;
  errorMessage?: string | undefined;
  onSubmit: (input: InviteUserInput) => void;
};

/**
 * 担当者追加 (invite): 氏名, the email typed twice, アカウントタイプ and a manager's permissions.
 * AM (staff) is preselected when the caller may give it.
 */
export const UserCreateForm = ({
  roleField,
  canEditPermissions,
  pending,
  errorMessage,
  onSubmit,
}: UserCreateFormProps) => {
  const form = useForm<InviteUserFormInput>({
    resolver: zodResolver(inviteUserFormSchema),
    defaultValues: {
      name: "",
      email: "",
      emailConfirm: "",
      role: roleField.options.includes("staff") ? "staff" : (roleField.options[0] ?? DEFAULT_ROLE),
    },
  });

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={form.handleSubmit((values) => {
            onSubmit(toInviteInput(values));
          })}
        >
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>担当者を追加できませんでした</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <UserFormFields
            control={form.control}
            roleField={roleField}
            canEditPermissions={canEditPermissions}
          >
            <TextField
              control={form.control}
              name="email"
              type="email"
              label="メールアドレス"
              autoComplete="off"
              required
            />
            <TextField
              control={form.control}
              name="emailConfirm"
              type="email"
              label="メールアドレス（確認）"
              autoComplete="off"
              required
            />
          </UserFormFields>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || roleField.disabled}>
              {pending ? "送信中…" : "招待メールを送信"}
            </Button>
            <Button
              variant="outline"
              render={<Link href={href(routes.user.list)} />}
              nativeButton={false}
            >
              キャンセル
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
