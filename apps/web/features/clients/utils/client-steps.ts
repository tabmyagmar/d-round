import type { FieldPath } from "react-hook-form";

import type { ClientFormValues } from "@repo/validation";

/** The client form's steps: the legacy STEP1 / 確認, the first named after what it holds. */
export const CLIENT_STEP_LABELS = ["基本情報", "確認"] as const;

/** Each step's fields, validated before 次へ (`useStepper`); the confirm step has none. */
export const CLIENT_STEP_FIELDS: readonly (readonly FieldPath<ClientFormValues>[])[] = [
  [
    "number",
    "name",
    "nameKana",
    "areas",
    "regionCodes",
    "chargerUserIds",
    "address",
    "phoneNumber",
    "fax",
    "webUrl",
    "orderTypes",
  ],
  [],
];
