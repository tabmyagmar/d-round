import type { FieldPath } from "react-hook-form";

import type { StaffFormValues } from "@repo/validation";

/** The staff form's steps: the legacy ステップ1 / ステップ2 / 確認, named after what they hold. */
export const STAFF_STEP_LABELS = ["基本情報", "家族情報・メモ", "確認"] as const;

/** Each step's fields, validated before 次へ (`useStepper`); the confirm step has none. */
export const STAFF_STEP_FIELDS: readonly (readonly FieldPath<StaffFormValues>[])[] = [
  [
    "employeeType",
    "employeeNumber",
    "lastName",
    "firstName",
    "lastNameKana",
    "firstNameKana",
    "areas",
    "regionCodes",
    "prefectureCodes",
    "chargerUserIds",
    "birthday",
    "gender",
    "branchName",
    "position",
    "address",
    "phoneNumber",
    "emergencyPhoneNumber",
    "email",
    "jobHistories",
  ],
  ["familyMembers", "memos"],
  [],
];

/** The first step holding one of these field errors, for a confirm that failed after all. */
export const stepOfErrors = (errorKeys: readonly string[]): number =>
  Math.max(
    0,
    STAFF_STEP_FIELDS.findIndex((fields) => fields.some((field) => errorKeys.includes(field))),
  );
