import { describe, expect, it } from "vitest";

import { CLIENT_ORDER_TYPES, GENERAL_STATUSES } from "../../src/client.schema";
import {
  AREA_BY_LABEL,
  EMPLOYEE_TYPE_BY_LABEL,
  FAMILY_RELATION_BY_LABEL,
  GENDER_BY_LABEL,
  ORDER_TYPE_BY_LABEL,
  POSITION_BY_LABEL,
  ROLE_BY_LABEL,
  STATUS_BY_LABEL,
  USER_STATUS_BY_LABEL,
  labelOf,
} from "../../src/csv";
import { SOURCE_AREAS } from "../../src/source.schema";
import { EMPLOYEE_TYPES, FAMILY_RELATIONS, GENDERS, STAFF_STATUSES } from "../../src/staff.schema";
import { POSITIONS, USER_STATUSES } from "../../src/user.schema";

describe("labelOf", () => {
  it("writes the first label of a code, so a ダウンロード reads as the legacy files", () => {
    expect(labelOf(POSITION_BY_LABEL, "SV")).toBe("AM");
    expect(labelOf(ROLE_BY_LABEL, "manager")).toBe("マネージャー");
    expect(labelOf(STATUS_BY_LABEL, "SUSPENDED")).toBe("停止");
    expect(labelOf(USER_STATUS_BY_LABEL, "deactivated")).toBe("停止");
  });

  it("has a label for every code a download writes", () => {
    const vocabularies = [
      [AREA_BY_LABEL, SOURCE_AREAS],
      [POSITION_BY_LABEL, POSITIONS],
      [EMPLOYEE_TYPE_BY_LABEL, EMPLOYEE_TYPES],
      [GENDER_BY_LABEL, GENDERS],
      [ORDER_TYPE_BY_LABEL, CLIENT_ORDER_TYPES],
      [FAMILY_RELATION_BY_LABEL, FAMILY_RELATIONS],
      [STATUS_BY_LABEL, GENERAL_STATUSES],
      [STATUS_BY_LABEL, STAFF_STATUSES],
      [USER_STATUS_BY_LABEL, USER_STATUSES],
    ] as const;

    for (const [byLabel, codes] of vocabularies) {
      const labelled = new Set<string>(Object.values(byLabel));
      expect(codes.filter((code) => !labelled.has(code))).toEqual([]);
    }
  });
});
