"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { FormFieldShell } from "@repo/ui/components/form";
import { isOverridableRole, roleSchema, updateUserSchema } from "@repo/validation";
import type { UpdateUserInput } from "@repo/validation";

import { href, routes } from "@/config/routes";
import { UserFormFields } from "@/features/users/components/form/user-form-fields";
import type { UserDetail } from "@/features/users/types";
import type { RoleFieldState } from "@/features/users/utils/role-field-state";
import { toUpdateInput } from "@/features/users/utils/user-form-input";

export type UserUpdateFormProps = {
  user: UserDetail;
  roleField: RoleFieldState;
  canEditPermissions: boolean;
  pending: boolean;
  errorMessage?: string | undefined;
  onSubmit: (input: UpdateUserInput) => void;
};

/**
 * 担当者情報編集: 姓 / 名 / セイ / メイ, アカウントタイプ and a manager's permissions; the email is
 * shown, not edited.
 * 保存 is enabled once something changed and sends only the changes.
 */
export const UserUpdateForm = ({
  user,
  roleField,
  canEditPermissions,
  pending,
  errorMessage,
  onSubmit,
}: UserUpdateFormProps) => {
  // users.role references the role catalog, whose keys are exactly ROLES (role-catalog parity test).
  const currentRole = roleSchema.parse(user.role);
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      userId: user.id,
      // A user from before the name parts has none: the form asks for them.
      lastName: user.lastName ?? "",
      firstName: user.firstName ?? "",
      lastNameKana: user.lastNameKana ?? "",
      firstNameKana: user.firstNameKana ?? "",
      role: currentRole,
      ...(isOverridableRole(currentRole) ? { permissionKeys: user.permissionKeys } : {}),
    },
  });

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={form.handleSubmit((values) => {
            onSubmit(toUpdateInput({ ...user, role: currentRole }, values));
          })}
        >
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>担当者情報を更新できませんでした</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <UserFormFields
            control={form.control}
            roleField={roleField}
            canEditPermissions={canEditPermissions}
          >
            <FormFieldShell htmlFor="user-email" label="メールアドレス" error={undefined}>
              <p id="user-email" className="text-sm break-all">
                {user.email}
              </p>
            </FormFieldShell>
          </UserFormFields>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || !form.formState.isDirty}>
              {pending ? "保存中…" : "保存"}
            </Button>
            <Button
              variant="outline"
              render={<Link href={href(routes.user.detail, { id: user.id })} />}
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
