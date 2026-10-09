"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { TextField } from "@repo/ui/components/form";

/** 姓 / 名 / セイ / メイ: the name parts a 担当者 and a スタッフ both carry. */
export type NameValues = {
  lastName?: string | undefined;
  firstName?: string | undefined;
  lastNameKana?: string | undefined;
  firstNameKana?: string | undefined;
};

/** Where the four parts sit in a form whose keys differ (a 就業先部署's 連絡担当者). */
export type NameFieldNames<TValues extends FieldValues> = Record<
  keyof NameValues,
  FieldPath<TValues>
>;

export type NameFieldsProps<TValues extends FieldValues> = {
  control: Control<TValues>;
  /** Left out where the form's own keys are `NameValues`' (the user and staff forms). */
  names?: NameFieldNames<TValues>;
  disabled?: boolean;
};

/**
 * 姓 / 名 and their katakana readings セイ / メイ, two per row as in the legacy forms: the user
 * forms (invite, edit, profile), the staff form and, through `names`, the 就業先部署 form's
 * 連絡担当者. The schemas require all four and full-width katakana for the readings.
 */
export const NameFields = <TValues extends FieldValues>({
  control,
  names,
  disabled = false,
}: NameFieldsProps<TValues>) => {
  const name = (key: keyof NameValues): FieldPath<TValues> =>
    names?.[key] ?? (key as FieldPath<TValues>);
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
