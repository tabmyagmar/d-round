import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/unstable-core-do-not-import";

import { isDomainError } from "./errors";
import type { DomainErrorCode } from "./errors";

/**
 * Domain → transport error mapping. One table per transport; adding GraphQL/REST later
 * means adding a sibling mapper here, never touching services.
 */

const TRPC_CODE_BY_DOMAIN_CODE: Record<DomainErrorCode, TRPC_ERROR_CODE_KEY> = {
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  VALIDATION: "BAD_REQUEST",
};

export const HTTP_STATUS_BY_DOMAIN_CODE: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  VALIDATION: 400,
};

export const INTERNAL_ERROR_MESSAGE = "Internal server error";

export const toTRPCError = (error: unknown): TRPCError => {
  if (error instanceof TRPCError) {
    return error;
  }
  if (isDomainError(error)) {
    return new TRPCError({
      code: TRPC_CODE_BY_DOMAIN_CODE[error.code],
      message: error.message,
      cause: error,
    });
  }
  // Unknown failures never leak their message to clients; the cause is logged server-side.
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: INTERNAL_ERROR_MESSAGE,
    cause: error,
  });
};

export const toHttpStatus = (error: unknown): number =>
  isDomainError(error) ? HTTP_STATUS_BY_DOMAIN_CODE[error.code] : 500;
