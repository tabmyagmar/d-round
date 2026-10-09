import type { FieldPath } from "react-hook-form";

import type { BranchFormValues } from "@repo/validation";

/** The branch form's steps: the legacy STEP1 / 確認, the first named after what it holds. */
export const BRANCH_STEP_LABELS = ["基本情報", "確認"] as const;

/** Each step's fields, validated before 次へ (`useStepper`); the confirm step has none. */
export const BRANCH_STEP_FIELDS: readonly (readonly FieldPath<BranchFormValues>[])[] = [
  [
    "clientId",
    "number",
    "name",
    "nameKana",
    "area",
    "regionCode",
    "chargerUserIds",
    "departmentNumber",
    "departmentName",
    "departmentNameKana",
    "departmentFax",
    "address",
    "contactLastName",
    "contactFirstName",
    "contactLastNameKana",
    "contactFirstNameKana",
    "contactPosition",
    "contactEmail",
    "memo",
  ],
  [],
];
