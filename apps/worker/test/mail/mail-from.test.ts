import { describe, expect, it } from "vitest";

import { mailDisplayName } from "../../src/mail/mail-from";

describe("mailDisplayName", () => {
  it("returns the display name in front of the address", () => {
    expect(mailDisplayName("Acme Portal <no-reply@acme.example>")).toBe("Acme Portal");
    expect(mailDisplayName('"Acme, Inc." <no-reply@acme.example>')).toBe("Acme, Inc.");
  });

  it("falls back to the bare address when there is no display name", () => {
    expect(mailDisplayName("no-reply@acme.example")).toBe("no-reply@acme.example");
    expect(mailDisplayName("<no-reply@acme.example>")).toBe("no-reply@acme.example");
  });
});
