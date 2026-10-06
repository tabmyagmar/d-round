/**
 * Links into the web app that the API puts in mails. The paths mirror the web route catalog
 * (`apps/web/config/routes.ts`, which notes this file): the API cannot import the web app.
 */
export const webLinks = {
  /** Set or reset a password; Better Auth appends `?token=…` (or `?error=INVALID_TOKEN`). */
  newPassword: (webOrigin: string): string => new URL("/new-password", webOrigin).toString(),
};
