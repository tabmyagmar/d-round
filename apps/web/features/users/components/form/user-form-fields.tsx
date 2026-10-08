"use client";

import type { ReactNode } from "react";
import { useController, useWatch } from "react-hook-form";
import type { Control, FieldPath } from "react-hook-form";

import { FieldGroup } from "@repo/ui/components/field";
import { DateField, NumberField, SelectField, TextField } from "@repo/ui/components/form";
import { ja } from "@repo/ui/lib/calendar-locale";
import { isOverridableRole } from "@repo/validation";
import type { Role, UserProfileInput } from "@repo/validation";

import { HierarchyFields } from "@/components/source/hierarchy-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { PermissionField } from "@/features/users/components/form/permission-field";
import type { RoleFieldState } from "@/features/users/utils/role-field-state";
import type { ProfileFormValues } from "@/features/users/utils/user-form-input";
import { POSITION_OPTIONS, ROLE_LABELS } from "@/features/users/utils/user-labels";

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
  profile?: ProfileFormValues | undefined;
};

/** A shared field's path in the form's own values (every user form has these keys). */
const path = <TValues extends UserFieldValues>(name: keyof UserFieldValues) =>
  name as FieldPath<TValues>;

/** A 担当者 profile field's path (ADR 0007). */
const profilePath = <TValues extends UserFieldValues>(name: keyof UserProfileInput) =>
  `profile.${name}` as FieldPath<TValues>;

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
 * shows it (an AM or admin user) keeps no `permissionKeys` value, so its `isDirty` stays false —
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
  /** Regions for エリア → 地域 (`useSourceHierarchy` in the container). */
  hierarchy: SourceHierarchy;
  /** Rendered between 役職 and アカウントタイプ (the email fields). */
  children?: ReactNode;
};

/**
 * What the invite form and the edit form share, in the legacy order: 社員番号, 姓 / 名 / セイ / メイ,
 * エリア / 地域, 部署名 / 役職, (the form's email fields), アカウントタイプ / 退職日 and, for a manager,
 * 権限（詳細設定）. Each form owns its schema and submit.
 */
export const UserFormFields = <TValues extends UserFieldValues>({
  control,
  roleField,
  canEditPermissions,
  hierarchy,
  children,
}: UserFormFieldsProps<TValues>) => {
  const role = useWatch({ control, name: path<TValues>("role") }) as Role | undefined;

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          control={control}
          name={profilePath<TValues>("employeeNumber")}
          label="社員番号"
          placeholder="社員番号"
          min={1}
          inputMode="numeric"
          required
        />
      </div>
      <UserNameFields control={control} />
      <div className="grid gap-4 sm:grid-cols-2">
        <HierarchyFields
          control={control}
          hierarchy={hierarchy}
          names={{
            areas: profilePath<TValues>("areas"),
            regionCodes: profilePath<TValues>("regionCodes"),
          }}
          required
        />
        <TextField
          control={control}
          name={profilePath<TValues>("departmentName")}
          label="部署名"
          placeholder="部署名"
          required
        />
        <SelectField
          control={control}
          name={profilePath<TValues>("position")}
          label="役職"
          placeholder="役職を選択"
          options={POSITION_OPTIONS}
          required
        />
      </div>
      {children}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name={path<TValues>("role")}
          label="アカウントタイプ"
          options={roleField.options.map((option) => ({
            value: option,
            label: ROLE_LABELS[option],
          }))}
          disabled={roleField.disabled}
          required
        />
        <DateField
          control={control}
          name={profilePath<TValues>("retirementDate")}
          label="退職日"
          placeholder="YYYY/MM/DD"
          nullable
          locale="ja-JP"
          calendarLocale={ja}
        />
      </div>
      {canEditPermissions && role !== undefined && isOverridableRole(role) ? (
        <PermissionKeysField control={control} role={role} />
      ) : null}
    </FieldGroup>
  );
};
