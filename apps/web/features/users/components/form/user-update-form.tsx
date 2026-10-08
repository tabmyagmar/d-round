"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { StickyBar } from "@repo/ui/components/composed/sticky-bar";
import { FormActions, FormFieldShell } from "@repo/ui/components/form";
import { isOverridableRole, roleSchema, updateUserFormSchema } from "@repo/validation";
import type { UpdateUserFormInput, UpdateUserInput } from "@repo/validation";

import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { href, routes } from "@/config/routes";
import { UserFormFields } from "@/features/users/components/form/user-form-fields";
import type { UserDetail } from "@/features/users/types";
import type { RoleFieldState } from "@/features/users/utils/role-field-state";
import { profileFormValuesOf, toUpdateInput } from "@/features/users/utils/user-form-input";
import { EMPLOYEE_NUMBER_TAKEN } from "@/features/users/utils/user-labels";

export type UserUpdateFormProps = {
  user: UserDetail;
  roleField: RoleFieldState;
  canEditPermissions: boolean;
  hierarchy: SourceHierarchy;
  /** Asked before saving a changed 社員番号 (legacy userNumberExists, the user left out). */
  isEmployeeNumberFree: (employeeNumber: number) => Promise<boolean>;
  pending: boolean;
  errorMessage?: string | undefined;
  onSubmit: (input: UpdateUserInput) => void;
};

/**
 * 担当者情報編集: the invite form's fields, the email shown and not edited. A user from before
 * profiles is asked for one. キャンセル / 保存 sit in the bar at the bottom of the page; 保存 is
 * enabled once something changed and sends only the changes.
 */
export const UserUpdateForm = ({
  user,
  roleField,
  canEditPermissions,
  hierarchy,
  isEmployeeNumberFree,
  pending,
  errorMessage,
  onSubmit,
}: UserUpdateFormProps) => {
  // users.role references the role catalog, whose keys are exactly ROLES (role-catalog parity test).
  const currentRole = roleSchema.parse(user.role);
  const form = useForm<UpdateUserFormInput>({
    resolver: zodResolver(updateUserFormSchema),
    defaultValues: {
      userId: user.id,
      // A user from before the name parts has none: the form asks for them.
      lastName: user.lastName ?? "",
      firstName: user.firstName ?? "",
      lastNameKana: user.lastNameKana ?? "",
      firstNameKana: user.firstNameKana ?? "",
      role: currentRole,
      ...(isOverridableRole(currentRole) ? { permissionKeys: user.permissionKeys } : {}),
      profile: profileFormValuesOf(user.profile),
    },
  });

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-6"
      onSubmit={form.handleSubmit(async (values) => {
        const employeeNumber = values.profile.employeeNumber;
        if (
          employeeNumber !== user.profile?.employeeNumber &&
          !(await isEmployeeNumberFree(employeeNumber))
        ) {
          form.setError(
            "profile.employeeNumber",
            { type: "manual", message: EMPLOYEE_NUMBER_TAKEN },
            { shouldFocus: true },
          );
          return;
        }
        onSubmit(toUpdateInput({ ...user, role: currentRole }, values));
      })}
    >
      <Card className="max-w-2xl">
        <CardContent className="flex flex-col gap-6">
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
            hierarchy={hierarchy}
          >
            <FormFieldShell htmlFor="user-email" label="メールアドレス" error={undefined}>
              <p id="user-email" className="text-sm break-all">
                {user.email}
              </p>
            </FormFieldShell>
          </UserFormFields>
        </CardContent>
      </Card>
      <StickyBar>
        <FormActions
          className="max-w-2xl"
          submitLabel="保存"
          pendingLabel="保存中…"
          pending={pending}
          disabled={!form.formState.isDirty}
        >
          <Button
            variant="outline"
            render={<Link href={href(routes.user.detail, { id: user.id })} />}
            nativeButton={false}
          >
            キャンセル
          </Button>
        </FormActions>
      </StickyBar>
    </form>
  );
};
