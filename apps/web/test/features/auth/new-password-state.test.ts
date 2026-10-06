import { describe, expect, it } from "vitest";

import { newPasswordState } from "@/features/auth/new-password-state";

describe("newPasswordState", () => {
  it("shows the form for a token from the mailed link", () => {
    expect(newPasswordState({ token: "abc123" })).toEqual({ kind: "form", token: "abc123" });
  });

  it("shows the invalid-link message when Better Auth redirected with an error", () => {
    expect(newPasswordState({ error: "INVALID_TOKEN" })).toEqual({ kind: "invalid" });
    expect(newPasswordState({ token: "abc123", error: "INVALID_TOKEN" })).toEqual({
      kind: "invalid",
    });
  });

  it.each([[{}], [{ token: "" }], [{ token: ["a", "b"] }]])(
    "treats a missing, empty or repeated token %j as invalid",
    (params) => {
      expect(newPasswordState(params)).toEqual({ kind: "invalid" });
    },
  );
});
