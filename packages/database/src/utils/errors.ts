import { Prisma } from "../generated/prisma/client";

/**
 * Database-level error translation. Repositories let Prisma/pg errors bubble up; services
 * call `translateDatabaseError()` (or the `is*` guards) to turn them into domain errors.
 * Nothing outside this file should compare Prisma or Postgres error codes.
 */

/** Postgres SQLSTATE codes surfaced by raw queries and the pg driver adapter. */
export const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  NOT_NULL_VIOLATION: "23502",
} as const;

/** Prisma "known request error" codes. */
export const PRISMA_ERROR_CODES = {
  UNIQUE_VIOLATION: "P2002",
  FOREIGN_KEY_VIOLATION: "P2003",
  RECORD_NOT_FOUND: "P2025",
} as const;

export class DatabaseError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DatabaseError";
    this.cause = cause;
  }
}

export class UniqueViolationError extends DatabaseError {
  readonly fields: readonly string[];
  readonly constraint: string | undefined;

  constructor(fields: readonly string[], constraint: string | undefined, cause?: unknown) {
    const what = fields.length > 0 ? fields.join(", ") : (constraint ?? "unknown constraint");
    super(`Unique constraint violated: ${what}`, cause);
    this.name = "UniqueViolationError";
    this.fields = fields;
    this.constraint = constraint;
  }
}

export class ForeignKeyViolationError extends DatabaseError {
  readonly constraint: string | undefined;

  constructor(constraint: string | undefined, cause?: unknown) {
    super(`Foreign key constraint violated: ${constraint ?? "unknown constraint"}`, cause);
    this.name = "ForeignKeyViolationError";
    this.constraint = constraint;
  }
}

export class RecordNotFoundError extends DatabaseError {
  constructor(cause?: unknown) {
    super("Record not found", cause);
    this.name = "RecordNotFoundError";
  }
}

type PgErrorLike = { code: string; constraint?: string; detail?: string };

const isPgErrorLike = (error: unknown): error is PgErrorLike =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string" &&
  /^[0-9A-Z]{5}$/.test((error as { code: string }).code);

const KEY_DETAIL_PATTERN = /Key \(([^)]+)\)=/;

/** "Key (email, tenant_id)=(...) already exists." → ["email", "tenant_id"] */
const fieldsFromPgDetail = (detail: string | undefined): string[] => {
  const match = detail === undefined ? null : KEY_DETAIL_PATTERN.exec(detail);
  return match?.[1] ? match[1].split(",").map((field) => field.trim()) : [];
};

const fieldsFromPrismaMeta = (meta: Record<string, unknown> | undefined): string[] => {
  const target = meta?.["target"];
  if (Array.isArray(target)) {
    return target.filter((item): item is string => typeof item === "string");
  }
  return typeof target === "string" ? [target] : [];
};

const constraintFromPrismaMeta = (
  meta: Record<string, unknown> | undefined,
): string | undefined => {
  const constraint = meta?.["constraint"];
  if (typeof constraint === "string") {
    return constraint;
  }
  if (Array.isArray(constraint)) {
    return constraint.filter((item): item is string => typeof item === "string").join(", ");
  }
  const fieldName = meta?.["field_name"];
  return typeof fieldName === "string" ? fieldName : undefined;
};

/**
 * Returns a typed DatabaseError for constraint/not-found failures, or `undefined` when the
 * error is not a recognised database error (callers should then rethrow the original).
 */
export const translateDatabaseError = (error: unknown): DatabaseError | undefined => {
  if (error instanceof DatabaseError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta;
    switch (error.code) {
      case PRISMA_ERROR_CODES.UNIQUE_VIOLATION:
        return new UniqueViolationError(
          fieldsFromPrismaMeta(meta),
          constraintFromPrismaMeta(meta),
          error,
        );
      case PRISMA_ERROR_CODES.FOREIGN_KEY_VIOLATION:
        return new ForeignKeyViolationError(constraintFromPrismaMeta(meta), error);
      case PRISMA_ERROR_CODES.RECORD_NOT_FOUND:
        return new RecordNotFoundError(error);
      default:
        return undefined;
    }
  }

  if (isPgErrorLike(error)) {
    switch (error.code) {
      case PG_ERROR_CODES.UNIQUE_VIOLATION:
        return new UniqueViolationError(fieldsFromPgDetail(error.detail), error.constraint, error);
      case PG_ERROR_CODES.FOREIGN_KEY_VIOLATION:
        return new ForeignKeyViolationError(error.constraint, error);
      default:
        return undefined;
    }
  }

  return undefined;
};

export const isUniqueViolation = (error: unknown): error is UniqueViolationError =>
  translateDatabaseError(error) instanceof UniqueViolationError;

export const isForeignKeyViolation = (error: unknown): error is ForeignKeyViolationError =>
  translateDatabaseError(error) instanceof ForeignKeyViolationError;

export const isRecordNotFound = (error: unknown): error is RecordNotFoundError =>
  translateDatabaseError(error) instanceof RecordNotFoundError;
