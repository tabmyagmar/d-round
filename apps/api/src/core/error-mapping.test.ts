import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { INTERNAL_ERROR_MESSAGE, toHttpStatus, toTRPCError } from "./error-mapping";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";

describe("toTRPCError", () => {
  it("maps each domain error to the matching tRPC code and keeps the message", () => {
    const cases: [Error, string][] = [
      [new NotFoundError("User", "u1"), "NOT_FOUND"],
      [new ForbiddenError(), "FORBIDDEN"],
      [new ConflictError("Cannot demote the last admin"), "CONFLICT"],
      [new ValidationError("Invalid input", { details: [{ path: "email" }] }), "BAD_REQUEST"],
    ];

    for (const [domainError, expectedCode] of cases) {
      const mapped = toTRPCError(domainError);
      expect(mapped).toBeInstanceOf(TRPCError);
      expect(mapped.code).toBe(expectedCode);
      expect(mapped.message).toBe(domainError.message);
      expect(mapped.cause).toBe(domainError);
    }
  });

  it("passes TRPCError through untouched", () => {
    const original = new TRPCError({ code: "UNAUTHORIZED" });
    expect(toTRPCError(original)).toBe(original);
  });

  it("hides unknown errors behind INTERNAL_SERVER_ERROR but keeps the cause for logging", () => {
    const boom = new Error("connection refused to 10.0.0.5");
    const mapped = toTRPCError(boom);

    expect(mapped.code).toBe("INTERNAL_SERVER_ERROR");
    expect(mapped.message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(mapped.message).not.toContain("10.0.0.5");
    expect(mapped.cause).toBe(boom);
  });
});

describe("toHttpStatus", () => {
  it("maps domain errors to HTTP statuses and everything else to 500", () => {
    expect(toHttpStatus(new NotFoundError("User"))).toBe(404);
    expect(toHttpStatus(new ForbiddenError())).toBe(403);
    expect(toHttpStatus(new ConflictError("dup"))).toBe(409);
    expect(toHttpStatus(new ValidationError("bad"))).toBe(400);
    expect(toHttpStatus(new Error("x"))).toBe(500);
  });
});
