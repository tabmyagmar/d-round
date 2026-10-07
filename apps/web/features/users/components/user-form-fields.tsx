"use client";

import type { ReactNode } from "react";
import { useController, useWatch } from "react-hook-form";
import type { Control, FieldPath } from "react-hook-form";

import { FieldGroup } from "@repo/ui/components/field";
import { SelectField, TextField } from "@repo/ui/components/form";
import { isOverridableRole } from "@repo/validation";
import type { Role } from "@repo/validation";

import { PermissionField } from "@/features/users/components/permission-field";
import type { RoleFieldState } from "@/features/users/utils/role-field-state";
import { ROLE_LABELS } from "@/features/users/utils/user-labels";

/** The fields both user forms share; each form's values have at least these keys. */
export type UserFieldValues = {
  name?: string | undefined;
  role?: Role | undefined;
  permissionKeys?: string[] | undefined;
};

/** A shared field's path in the form's own values (every user form has these keys). */
const path = <TValues extends UserFieldValues>(name: keyof UserFieldValues) =>
  name as FieldPath<TValues>;

export type UserFormFieldsProps<TValues extends UserFieldValues> = {
  control: Control<TValues>;
  /** Which account types the caller may choose (`roleFieldState`). */
  roleField: RoleFieldState;
  /** The caller holds `changeRole` (and is not editing themselves). */
  canEditPermissions: boolean;
  /** Rendered between 氏名 and アカウントタイプ (the invite form's email fields). */
  children?: ReactNode;
};

/**
 * 氏名, アカウントタイプ and, for a manager, 権限（詳細設定）: what the invite form and the edit form
 * share. Each form owns its schema, submit and email fields.
 */
export const UserFormFields = <TValues extends UserFieldValues>({
  control,
  roleField,
  canEditPermissions,
  children,
}: UserFormFieldsProps<TValues>) => {
  const role = useWatch({ control, name: path<TValues>("role") }) as Role | undefined;
  const permissions = useController({ control, name: path<TValues>("permissionKeys") });

  return (
    <FieldGroup>
      <TextField control={control} name={path<TValues>("name")} label="氏名" required />
      {children}
      <SelectField
        control={control}
        name={path<TValues>("role")}
        label="アカウントタイプ"
        options={roleField.options.map((option) => ({ value: option, label: ROLE_LABELS[option] }))}
        disabled={roleField.disabled}
        required
      />
      {canEditPermissions && role !== undefined && isOverridableRole(role) ? (
        <PermissionField
          role={role}
          value={permissions.field.value as string[] | undefined}
          onChange={permissions.field.onChange}
        />
      ) : null}
    </FieldGroup>
  );
};
