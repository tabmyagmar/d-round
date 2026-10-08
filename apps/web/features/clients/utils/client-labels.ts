import type { SelectOption } from "@repo/ui/components/form";
import { CLIENT_ORDER_TYPES } from "@repo/validation";
import type { ClientOrderType } from "@repo/validation";

/** 受注区分 labels, as in the legacy app. */
export const CLIENT_ORDER_TYPE_LABELS: Record<ClientOrderType, string> = {
  CONTRACT_WORK: "業務請負",
  DISPATCH: "派遣",
  SPOT_WORK: "スポット",
};

export const CLIENT_ORDER_TYPE_OPTIONS: SelectOption<ClientOrderType>[] = CLIENT_ORDER_TYPES.map(
  (type) => ({ value: type, label: CLIENT_ORDER_TYPE_LABELS[type] }),
);

/** 受注区分 by name ("業務請負、派遣"), or `null` with none. */
export const orderTypeNamesOf = (types: readonly ClientOrderType[]): string | null =>
  types.length > 0 ? types.map((type) => CLIENT_ORDER_TYPE_LABELS[type]).join("、") : null;

/** The 担当者 by name, as the list and the detail show them, or `null` with none. */
export const chargerNamesOf = (chargers: readonly { user: { name: string } }[]): string | null =>
  chargers.length > 0 ? chargers.map((charger) => charger.user.name).join("、") : null;

/** What the client form says when another client holds the クライアント番号 (legacy wording). */
export const CLIENT_NUMBER_TAKEN = "このクライアント番号は既に使用されています";
