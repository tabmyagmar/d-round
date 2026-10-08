"use client";

import type { Control, FieldPath } from "react-hook-form";

import { TextField } from "@repo/ui/components/form";

/** 姓 / 名 / セイ / メイ: the name parts a 担当者 and a スタッフ both carry. */
export type NameValues = {
  lastName?: string | undefined;
  firstName?: string | undefined;
  lastNameKana?: string | undefined;
  firstNameKana?: string | undefined;
};

/**
 * 姓 / 名 and their katakana readings セイ / メイ, two per row as in the legacy forms: the user
 * forms (invite, edit, profile) and the staff form. The schema (`userNameSchema`) requires all four
 * and full-width katakana for the readings.
 */
export const NameFields = <TValues extends NameValues>({
  control,
  disabled = false,
}: {
  control: Control<TValues>;
  disabled?: boolean;
}) => {
  const name = (key: keyof NameValues) => key as FieldPath<TValues>;
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
