/**
 * What `/new-password` shows. Better Auth's link (`/api/auth/reset-password/:token`) redirects
 * here with `?token=…` when the token is valid and with `?error=INVALID_TOKEN` when it expired or
 * was used; anything else is treated as an invalid link too.
 */
export type NewPasswordState = { kind: "form"; token: string } | { kind: "invalid" };

export type NewPasswordParams = {
  token?: string | string[] | undefined;
  error?: string | string[] | undefined;
};

export const newPasswordState = ({ token, error }: NewPasswordParams): NewPasswordState =>
  error === undefined && typeof token === "string" && token !== ""
    ? { kind: "form", token }
    : { kind: "invalid" };
