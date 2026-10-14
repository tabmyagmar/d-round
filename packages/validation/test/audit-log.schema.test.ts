import { describe, expect, it } from "vitest";

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_FIELDS,
  auditFieldLabel,
  maskedAuditFields,
} from "../src/audit-log.schema";

describe("audit log names", () => {
  it("labels a changed field by its entity's registry, an event's field, or its key", () => {
    expect(auditFieldLabel("Client", "orderTypes")).toBe("受注区分");
    expect(auditFieldLabel("User", "permissions")).toBe("権限設定");
    expect(auditFieldLabel("User", "endpoint")).toBe("エンドポイント");
    expect(auditFieldLabel(null, "unknown")).toBe("unknown");
  });

  it("masks the personal fields the plan lists, and nothing else", () => {
    expect([...maskedAuditFields("Staff")].sort()).toEqual(
      [
        "address1",
        "birthday",
        "email",
        "emergencyPhoneNumber",
        "familyMembers",
        "phoneNumber",
        "postCode",
        "prefCity",
      ].sort(),
    );
    expect([...maskedAuditFields("User")]).toEqual(["email"]);
    expect([...maskedAuditFields("Branch")]).toEqual(["contactEmail"]);
    expect([...maskedAuditFields("Client")]).toEqual([]);
  });

  it("gives every action and every field list a known entity type, and unique field keys", () => {
    for (const { entityType } of Object.values(AUDIT_ACTIONS)) {
      expect(Object.keys(AUDIT_ENTITY_TYPES)).toContain(entityType);
    }
    for (const fields of Object.values(AUDIT_FIELDS)) {
      const keys = fields.map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
