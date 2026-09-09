/**
 * Domain errors — the ONLY error types services may throw. They carry no transport
 * knowledge; core/error-mapping.ts translates them for tRPC (and later GraphQL/REST).
 */

export type DomainErrorCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "VALIDATION";

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;
  /** Safe-to-expose structured details (e.g. validation issues). Never secrets. */
  readonly details: unknown;

  constructor(message: string, options: { cause?: unknown; details?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.details = options.details;
  }
}

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";

  constructor(entity: string, id?: string, options?: { cause?: unknown }) {
    super(id === undefined ? `${entity} not found` : `${entity} ${id} not found`, options);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = "FORBIDDEN";

  constructor(
    message = "You are not allowed to perform this action",
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export class ConflictError extends DomainError {
  readonly code = "CONFLICT";
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION";
}

export const isDomainError = (error: unknown): error is DomainError => error instanceof DomainError;
