"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { StickyBar } from "@repo/ui/components/composed/sticky-bar";
import { FormActions, TextField } from "@repo/ui/components/form";
import { DEFAULT_ROLE, inviteUserFormSchema } from "@repo/validation";
import type { InviteUserFormInput, InviteUserInput } from "@repo/validation";

import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { href, routes } from "@/config/routes";
import { UserFormFields } from "@/features/users/components/form/user-form-fields";
import type { RoleFieldState } from "@/features/users/utils/role-field-state";
import { EMPTY_PROFILE, toInviteInput } from "@/features/users/utils/user-form-input";
import { EMPLOYEE_NUMBER_TAKEN } from "@/features/users/utils/user-labels";

export type UserCreateFormProps = {
  roleField: RoleFieldState;
  canEditPermissions: boolean;
  hierarchy: SourceHierarchy;
  /** Asked before sending (legacy userNumberExists); a taken number stays on the field. */
  isEmployeeNumberFree: (employeeNumber: number) => Promise<boolean>;
  pending: boolean;
  onSubmit: (input: InviteUserInput) => void;
};

/**
 * 担当者追加 (invite): the legacy fields — 社員番号, 姓 / 名 / セイ / メイ, エリア / 地域, 部署名 / 役職,
 * the email typed twice, アカウントタイプ / 退職日 and a manager's permissions — with キャンセル /
 * 招待メールを送信 in the bar at the bottom of the page. AM is preselected when the caller may give
 * it.
 */
export const UserCreateForm = ({
  roleField,
  canEditPermissions,
  hierarchy,
  isEmployeeNumberFree,
  pending,
  onSubmit,
}: UserCreateFormProps) => {
  const form = useForm<InviteUserFormInput>({
    resolver: zodResolver(inviteUserFormSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      lastNameKana: "",
      firstNameKana: "",
      email: "",
      emailConfirm: "",
      role: roleField.options.includes("am") ? "am" : (roleField.options[0] ?? DEFAULT_ROLE),
      profile: EMPTY_PROFILE,
    },
  });

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-6"
      onSubmit={form.handleSubmit(async (values) => {
        if (!(await isEmployeeNumberFree(values.profile.employeeNumber))) {
          form.setError(
            "profile.employeeNumber",
            { type: "manual", message: EMPLOYEE_NUMBER_TAKEN },
            { shouldFocus: true },
          );
          return;
        }
        onSubmit(toInviteInput(values));
      })}
    >
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="flex flex-col gap-6">
          <UserFormFields
            control={form.control}
            roleField={roleField}
            canEditPermissions={canEditPermissions}
            hierarchy={hierarchy}
          >
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
          </UserFormFields>
        </CardContent>
      </Card>
      <StickyBar>
        <FormActions
          className="mx-auto w-full max-w-2xl"
          submitLabel="招待メールを送信"
          pendingLabel="送信中…"
          pending={pending}
          disabled={roleField.disabled}
        >
          <Button
            variant="outline"
            render={<Link href={href(routes.user.list)} />}
            nativeButton={false}
          >
            キャンセル
          </Button>
        </FormActions>
      </StickyBar>
    </form>
  );
};
