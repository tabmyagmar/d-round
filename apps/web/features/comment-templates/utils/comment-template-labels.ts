import { formatDate } from "@repo/ui/components/form";
import type { SelectOption } from "@repo/ui/components/form";
import { COMMENT_FOR } from "@repo/validation";
import type { CommentFor } from "@repo/validation";

/** 使用先メニュー labels, as the legacy `EnumCommentFor` values. */
export const COMMENT_FOR_LABELS: Record<CommentFor, string> = {
  WORKFLOW: "ワークフロー承認画面用コメント",
  APPLICATION: "ワークフロー一覧用メモ",
  CLIENT: "クライアント管理",
  STAFF: "スタッフ管理",
};

/** The form's choices, in the legacy order. */
export const COMMENT_FOR_OPTIONS: readonly SelectOption[] = COMMENT_FOR.map((value) => ({
  value,
  label: COMMENT_FOR_LABELS[value],
}));

/** A row's menus as the list shows them, in the legacy order. */
export const typesLabel = (types: readonly CommentFor[]): string =>
  COMMENT_FOR.filter((type) => types.includes(type))
    .map((type) => COMMENT_FOR_LABELS[type])
    .join("、");

/** 作成日 as the legacy list showed it: YYYY/MM/DD. */
export const createdOn = (date: Date): string => formatDate(date, "ja-JP");
