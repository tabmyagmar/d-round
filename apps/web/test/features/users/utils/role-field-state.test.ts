import { describe, expect, it } from "vitest";

import { roleFieldState } from "@/features/users/utils/role-field-state";

describe("roleFieldState", () => {
  it("offers what the caller may assign when inviting", () => {
    expect(roleFieldState({ callerRole: "admin", canChangeRole: true })).toEqual({
      options: ["admin", "manager", "am"],
      disabled: false,
    });
    expect(roleFieldState({ callerRole: "manager", canChangeRole: false })).toEqual({
      options: ["manager", "am"],
      disabled: false,
    });
  });

  it("disables the field when the caller may assign nothing", () => {
    expect(roleFieldState({ callerRole: "am", canChangeRole: false })).toEqual({
      options: [],
      disabled: true,
    });
  });

  it("lets a caller holding changeRole change a role they may assign", () => {
    expect(
      roleFieldState({ callerRole: "admin", canChangeRole: true, currentRole: "manager" }),
    ).toEqual({ options: ["admin", "manager", "am"], disabled: false });
  });

  it("shows only the current role, disabled, when the caller may not change it", () => {
    expect(
      roleFieldState({ callerRole: "admin", canChangeRole: false, currentRole: "manager" }),
    ).toEqual({ options: ["manager"], disabled: true });
    expect(
      roleFieldState({ callerRole: "admin", canChangeRole: true, currentRole: "super_admin" }),
    ).toEqual({ options: ["super_admin"], disabled: true });
  });
});
