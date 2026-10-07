"use client";

import type { ReactNode } from "react";
import { useController, useWatch } from "react-hook-form";
import type { Control, FieldPath } from "react-hook-form";

import { FieldGroup } from "@repo/ui/components/field";
import { SelectField, TextField } from "@repo/ui/components/form";
import { isOverridableRole } from "@repo/validation";
import type { Role } from "@repo/validation";

import { PermissionField } from "@/features/users/components/form/permission-field";
import type { RoleFieldState } from "@/features/users/utils/role-field-state";
import { ROLE_LABELS } from "@/features/users/utils/user-labels";

/** 姓 / 名 / セイ / メイ: the name fields every user form has (invite, edit, profile). */
export type UserNameValues = {
  lastName?: string | undefined;
  firstName?: string | undefined;
  lastNameKana?: string | undefined;
  firstNameKana?: string | undefined;
};

/** The fields both user forms share; each form's values have at least these keys. */
export type UserFieldValues = UserNameValues & {
  role?: Role | undefined;
  permissionKeys?: string[] | undefined;
};

/** A shared field's path in the form's own values (every user form has these keys). */
const path = <TValues extends UserFieldValues>(name: keyof UserFieldValues) =>
  name as FieldPath<TValues>;

/**
 * 姓 / 名 and their katakana readings セイ / メイ, two per row as in the legacy form. The
 * schema (`userNameSchema`) requires all four and full-width katakana for the readings.
 */
export const UserNameFields = <TValues extends UserNameValues>({
  control,
  disabled = false,
}: {
  control: Control<TValues>;
  disabled?: boolean;
}) => {
  const name = (key: keyof UserNameValues) => key as FieldPath<TValues>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        control={control}
        name={name("lastName")}
        label="姓"
        autoComplete="family-name"
        disabled={disabled}
        required
      />
      <TextField
        control={control}
        name={name("firstName")}
        label="名"
        autoComplete="given-name"
        disabled={disabled}
        required
      />
      <TextField
        control={control}
        name={name("lastNameKana")}
        label="セイ"
        placeholder="ヤマダ"
        disabled={disabled}
        required
      />
      <TextField
        control={control}
        name={name("firstNameKana")}
        label="メイ"
        placeholder="タロウ"
        disabled={disabled}
        required
      />
    </div>
  );
};

/**
 * 権限（詳細設定） bound to `permissionKeys`. Registered only while it is shown: a form that never
 * shows it (a staff or admin user) keeps no `permissionKeys` value, so its `isDirty` stays false —
 * registering it everywhere left an `undefined` key behind after StrictMode's remount, which made
 * an untouched edit form dirty.
 */
const PermissionKeysField = <TValues extends UserFieldValues>({
  control,
  role,
}: {
  control: Control<TValues>;
  role: Role;
}) => {
  const permissions = useController({ control, name: path<TValues>("permissionKeys") });
  return (
    <PermissionField
      role={role}
      value={permissions.field.value as string[] | undefined}
      onChange={permissions.field.onChange}
    />
  );
};

export type UserFormFieldsProps<TValues extends UserFieldValues> = {
  control: Control<TValues>;
  /** Which account types the caller may choose (`roleFieldState`). */
  roleField: RoleFieldState;
  /** The caller holds `changeRole` (and is not editing themselves). */
  canEditPermissions: boolean;
  /** Rendered between the name and アカウントタイプ (the invite form's email fields). */
  children?: ReactNode;
};

/**
 * 姓 / 名 / セイ / メイ, アカウントタイプ and, for a manager, 権限（詳細設定）: what the invite form and
 * the edit form share. Each form owns its schema, submit and email fields.
 */
export const UserFormFields = <TValues extends UserFieldValues>({
  control,
  roleField,
  canEditPermissions,
  children,
}: UserFormFieldsProps<TValues>) => {
  const role = useWatch({ control, name: path<TValues>("role") }) as Role | undefined;

  return (
    <FieldGroup>
      <UserNameFields control={control} />
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
        <PermissionKeysField control={control} role={role} />
      ) : null}
    </FieldGroup>
  );
};
