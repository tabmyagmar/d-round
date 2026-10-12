import { createAuth } from "@repo/auth";
import type { Auth } from "@repo/auth";
import type { PrismaClient } from "@repo/database";
import type { Logger } from "@repo/logger";
import type { EmailQueue } from "@repo/queue";

import { createAuthEmailSenders } from "../modules/email/auth-emails";

export type AppAuthOptions = {
  db: PrismaClient;
  emailQueue: EmailQueue;
  logger: Logger;
  /** BETTER_AUTH_SECRET: signs sessions and the links in mails. */
  secret: string;
  /** API_URL: the links Better Auth mails point at it. */
  apiUrl: string;
  /** WEB_ORIGIN: the browser origin, trusted for redirects. */
  webOrigin: string;
  cookieDomain?: string | undefined;
};

/**
 * Better Auth as the app runs it, with its mails going through the outbox. The API's composition
 * root and the worker's (a CSV import invites users, ADR 0013) build it with this one function,
 * so both send the same mails with the same links.
 */
export const createAppAuth = (options: AppAuthOptions): Auth =>
  createAuth({
    prisma: options.db,
    secret: options.secret,
    baseURL: options.apiUrl,
    trustedOrigins: [options.webOrigin],
    ...(options.cookieDomain ? { cookieDomain: options.cookieDomain } : {}),
    // Outbox: row inside a transaction, job after commit; the worker sends the mail.
    ...createAuthEmailSenders({
      db: options.db,
      emailQueue: options.emailQueue,
      logger: options.logger,
    }),
  });
