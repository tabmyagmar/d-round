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

/** What the client form says when another client holds the クライアント番号 (legacy wording). */
export const CLIENT_NUMBER_TAKEN = "このクライアント番号は既に使用されています";

/**
 * A failed save as the legacy said it: a クライアント番号 another client took while the form was
 * open, otherwise the API's message (as the comment-template dialog's own `onError`).
 */
export const clientSaveErrorOf = (error: {
  message: string;
  data?: { code: string } | null | undefined;
}): string =>
  error.data?.code === "CONFLICT" ? "クライアント番号が既に登録されています" : error.message;
