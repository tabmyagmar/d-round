import type { SourceArea } from "../source.schema";
import type { EmployeeType, Gender } from "../staff.schema";
import type { Position, Role } from "../user.schema";

/**
 * The values a CSV writes as labels, with the code each stands for — the legacy CSV vocabulary
 * (d-round-api `src/jobs/utils/source.ts`, the templates under d-round-web `public/csv`), which
 * existing files use; a label the screens show differently is accepted as well.
 */

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
