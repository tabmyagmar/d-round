import type { SelectOption } from "@repo/ui/components/form";
import { FAMILY_RELATIONS } from "@repo/validation";
import type { FamilyRelation } from "@repo/validation";

/**
 * 続柄 labels, as in the legacy app. App-level because a スタッフ's 家族情報 and the CSV download
 * of its family sheet both name them.
 */
export const FAMILY_RELATION_LABELS: Record<FamilyRelation, string> = {
  HUSBAND: "夫",
  WIFE: "妻",
  FATHER: "父",
  MOTHER: "母",
  FATHER_IN_LAW: "義父",
  MOTHER_IN_LAW: "義母",
  GRANDFATHER: "祖父",
  GRANDMOTHER: "祖母",
  ELDEST_SON: "長男",
  SECOND_SON: "次男",
  THIRD_SON: "三男",
  ELDEST_DAUGHTER: "長女",
  SECOND_DAUGHTER: "次女",
  THIRD_DAUGHTER: "三女",
  GRANDCHILD: "孫",
  NEPHEW: "甥",
  NIECE: "姪",
  PARENTAL_UNCLE: "伯父",
  PARENTAL_AUNT: "伯母",
  UNCLE: "叔父",
  AUNT: "叔母",
  GREAT_GRANDFATHER: "曽祖父",
  GREAT_GRANDMOTHER: "曽祖母",
};

export const FAMILY_RELATION_OPTIONS: SelectOption<FamilyRelation>[] = FAMILY_RELATIONS.map(
  (relation) => ({ value: relation, label: FAMILY_RELATION_LABELS[relation] }),
);
