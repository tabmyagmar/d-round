import { describe, expect, it } from "vitest";

import { Prisma } from "../../src/generated/prisma/client";
import {
  ForeignKeyViolationError,
  RecordNotFoundError,
  UniqueViolationError,
  isUniqueViolation,
  translateDatabaseError,
} from "../../src/utils/errors";

const prismaError = (
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("boom", {
    code,
    clientVersion: "test",
    ...(meta ? { meta } : {}),
  });

describe("translateDatabaseError", () => {
  it("maps Prisma P2002 to UniqueViolationError with the offending fields", () => {
    const translated = translateDatabaseError(prismaError("P2002", { target: ["email"] }));

    expect(translated).toBeInstanceOf(UniqueViolationError);
    expect((translated as UniqueViolationError).fields).toEqual(["email"]);
    expect(translated?.message).toContain("email");
  });

  it("maps Prisma P2003 and P2025", () => {
    expect(translateDatabaseError(prismaError("P2003", { field_name: "user_id" }))).toBeInstanceOf(
      ForeignKeyViolationError,
    );
    expect(translateDatabaseError(prismaError("P2025"))).toBeInstanceOf(RecordNotFoundError);
  });

  it("maps raw Postgres 23505 (unique_violation) and parses fields from the detail", () => {
    const pgError = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
      constraint: "users_email_key",
      detail: "Key (email, tenant_id)=(a@b.c, 1) already exists.",
    });

    const translated = translateDatabaseError(pgError);

    expect(translated).toBeInstanceOf(UniqueViolationError);
    expect((translated as UniqueViolationError).fields).toEqual(["email", "tenant_id"]);
    expect((translated as UniqueViolationError).constraint).toBe("users_email_key");
    expect(translated?.cause).toBe(pgError);
    expect(isUniqueViolation(pgError)).toBe(true);
  });

  it("maps raw Postgres 23503 (foreign_key_violation)", () => {
    const pgError = Object.assign(new Error("fk"), { code: "23503", constraint: "orders_user_fk" });
    expect(translateDatabaseError(pgError)).toBeInstanceOf(ForeignKeyViolationError);
  });

  it("returns undefined for unrelated errors so callers rethrow them", () => {
    expect(translateDatabaseError(new Error("network down"))).toBeUndefined();
    expect(translateDatabaseError(prismaError("P2000"))).toBeUndefined();
    expect(
      translateDatabaseError(Object.assign(new Error("x"), { code: "ECONNREFUSED" })),
    ).toBeUndefined();
    expect(isUniqueViolation(new Error("nope"))).toBe(false);
  });
});
