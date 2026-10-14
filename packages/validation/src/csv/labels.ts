import type { ClientOrderType, GeneralStatus } from "../client.schema";
import type { SourceArea } from "../source.schema";
import type { EmployeeType, FamilyRelation, Gender } from "../staff.schema";
import type { Position, Role, UserStatus } from "../user.schema";

/**
 * The values a CSV writes as labels, with the code each stands for — the legacy CSV vocabulary
 * (d-round-api `src/jobs/utils/source.ts`, the templates under d-round-web `public/csv`), which
 * existing files use; a label the screens show differently is accepted as well. A ダウンロード
 * writes each code's first label (`labelOf`).
 */

/** The label a file writes for a code: the first naming it, else the code (legacy `getKeyByValue`). */
export const labelOf = <C extends string>(byLabel: Readonly<Record<string, C>>, code: C): string =>
  Object.keys(byLabel).find((label) => byLabel[label] === code) ?? code;

export const AREA_BY_LABEL = {
  東日本: "EAST",
  西日本: "WEST",
} as const satisfies Record<string, SourceArea>;

export const POSITION_BY_LABEL = {
  役員: "EXECUTIVE",
  エリア責任者: "AREA_MANAGER",
  地区責任者: "DISTRICT_MANAGER",
  AM: "SV",
  リーダー: "LEADER",
  派遣コーディネーター: "DISPATCH_COORDINATOR",
  正社員: "FULL_TIME_EMPLOYEE",
  エリア社員: "AREA_EMPLOYEE",
  契約社員: "CONTRACT_EMPLOYEE",
  請負スタッフ: "SUBCONTRACT_STAFF",
  派遣スタッフ: "DISPATCH_STAFF",
  スタッフ: "STAFF",
  その他: "OTHER",
} as const satisfies Record<string, Position>;

/**
 * アカウントタイプ: the roles the app can give (`super_admin` never is). The legacy browser check
 * wanted スタッフ for an AM while its server wanted AM, so both mean `am`; the screens say マネジャー.
 */
export const ROLE_BY_LABEL = {
  アドミン: "admin",
  マネージャー: "manager",
  マネジャー: "manager",
  AM: "am",
  スタッフ: "am",
} as const satisfies Record<string, Role>;

export const EMPLOYEE_TYPE_BY_LABEL = {
  役員: "EXECUTIVE",
  正社員: "FULL_TIME",
  契約社員: "CONTRACT",
  アルバイト: "PART_TIME",
  その他: "OTHER",
} as const satisfies Record<string, EmployeeType>;

export const GENDER_BY_LABEL = {
  男性: "MALE",
  女性: "FEMALE",
  その他: "OTHER",
} as const satisfies Record<string, Gender>;

/** 受注区分 (legacy `clientOrderTypeMap`). */
export const ORDER_TYPE_BY_LABEL = {
  業務請負: "CONTRACT_WORK",
  派遣: "DISPATCH",
  スポット: "SPOT_WORK",
} as const satisfies Record<string, ClientOrderType>;

/** 続柄 (legacy `familyRelationMap`): the 家族情報 sheet of a スタッフ ダウンロード. */
export const FAMILY_RELATION_BY_LABEL = {
  夫: "HUSBAND",
  妻: "WIFE",
  父: "FATHER",
  母: "MOTHER",
  義父: "FATHER_IN_LAW",
  義母: "MOTHER_IN_LAW",
  祖父: "GRANDFATHER",
  祖母: "GRANDMOTHER",
  長男: "ELDEST_SON",
  次男: "SECOND_SON",
  三男: "THIRD_SON",
  長女: "ELDEST_DAUGHTER",
  次女: "SECOND_DAUGHTER",
  三女: "THIRD_DAUGHTER",
  孫: "GRANDCHILD",
  甥: "NEPHEW",
  姪: "NIECE",
  伯父: "PARENTAL_UNCLE",
  伯母: "PARENTAL_AUNT",
  叔父: "UNCLE",
  叔母: "AUNT",
  曽祖父: "GREAT_GRANDFATHER",
  曽祖母: "GREAT_GRANDMOTHER",
} as const satisfies Record<string, FamilyRelation>;

/**
 * ステータス of a クライアント or 就業先部署, and of a スタッフ, whose three are the same (legacy
 * `generalStatusMap`; 停止 was `DELETE`).
 */
export const STATUS_BY_LABEL = {
  利用中: "ACTIVE",
  保留: "INACTIVE",
  停止: "SUSPENDED",
} as const satisfies Record<string, GeneralStatus>;

/** ステータス of a 担当者: 停止 is a deactivated user, as the list says. */
export const USER_STATUS_BY_LABEL = {
  利用中: "active",
  停止: "deactivated",
} as const satisfies Record<string, UserStatus>;
