import { describe, expect, it } from "vitest";

import {
  ACTION_OPTIONS,
  actionLabelOf,
  actorLabelOf,
  dayOf,
  entityTypeLabelOf,
  timeOf,
} from "@/features/audit-log/utils/audit-log-labels";

describe("audit log labels", () => {
  it("names an action and a target type, and keeps an unknown key as it is", () => {
    expect(actionLabelOf("staff.changeStatus")).toBe("スタッフステータス変更");
    expect(actionLabelOf("legacy.removed")).toBe("legacy.removed");
    expect(entityTypeLabelOf("Branch")).toBe("就業先部署");
    expect(entityTypeLabelOf(null)).toBeNull();
    expect(ACTION_OPTIONS).toContainEqual({ value: "auth.signIn", label: "ログイン" });
  });

  it("names the actor: the user, システム for a job, the typed address for an anonymous one", () => {
    expect(actorLabelOf({ actorType: "USER", actorName: "鈴木 花子", actorEmail: "a@b.c" })).toBe(
      "鈴木 花子",
    );
    expect(actorLabelOf({ actorType: "SYSTEM", actorName: null, actorEmail: null })).toBe(
      "システム",
    );
    expect(actorLabelOf({ actorType: "ANONYMOUS", actorName: null, actorEmail: "x@y.z" })).toBe(
      "x@y.z",
    );
  });

  it("writes the day and the time in Japan", () => {
    const lateUtc = new Date("2026-10-13T15:30:00Z");

    expect(dayOf(lateUtc)).toBe("2026/10/14");
    expect(timeOf(lateUtc)).toBe("00:30");
  });
});
