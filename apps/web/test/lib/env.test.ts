import { describe, expect, it } from "vitest";

import { EnvValidationError } from "@repo/validation/env";

import { loadPublicEnv } from "@/lib/env";

describe("loadPublicEnv", () => {
  it("returns the configured API origin", () => {
    expect(loadPublicEnv({ NEXT_PUBLIC_API_URL: "https://api.example.com" }).apiUrl).toBe(
      "https://api.example.com",
    );
  });

  it("falls back to the local API when the variable is unset", () => {
    expect(loadPublicEnv({}).apiUrl).toBe("http://localhost:4000");
  });

  it("refuses a malformed origin instead of building a broken client", () => {
    expect(() => loadPublicEnv({ NEXT_PUBLIC_API_URL: "localhost:4000" })).toThrow(
      EnvValidationError,
    );
  });
});
