import type { SelectOption } from "@repo/ui/components/form";
import { POSITIONS } from "@repo/validation";
import type { Position } from "@repo/validation";

/**
 * 役職 labels, as in the legacy app (its shared `lib/enums/values.ts`; SV is "AM"). App-level
 * because a 担当者 profile and a スタッフ both carry a 役職.
 */
export const POSITION_LABELS: Record<Position, string> = {
  EXECUTIVE: "役員",
  AREA_MANAGER: "エリア責任者",
  DISTRICT_MANAGER: "地区責任者",
  SV: "AM",
  LEADER: "リーダー",
  DISPATCH_COORDINATOR: "派遣コーディネーター",
  FULL_TIME_EMPLOYEE: "正社員",
  AREA_EMPLOYEE: "エリア社員",
  CONTRACT_EMPLOYEE: "契約社員",
  SUBCONTRACT_STAFF: "請負スタッフ",
  DISPATCH_STAFF: "派遣スタッフ",
  STAFF: "スタッフ",
  OTHER: "その他",
};

export const POSITION_OPTIONS: SelectOption<Position>[] = POSITIONS.map((position) => ({
  value: position,
  label: POSITION_LABELS[position],
}));
