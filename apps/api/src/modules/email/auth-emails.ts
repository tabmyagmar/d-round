import type { CreateAuthOptions } from "@repo/auth";
import { EMAIL_TEMPLATES } from "@repo/queue";

import { sendEmail } from "./email.service";
import type { EmailDeps } from "./email.service";

/**
 * Better Auth's mail callbacks, implemented with the outbox: each writes an `OutboxEmail` row and
 * enqueues it after commit; the worker renders and sends. Wired once in `src/index.ts` and in the
 * test harness, so the template choice is the same everywhere.
 */
export const createAuthEmailSenders = (
  deps: EmailDeps,
): Pick<CreateAuthOptions, "sendVerificationEmail" | "sendPasswordResetEmail"> => ({
  sendVerificationEmail: async ({ user, url }) => {
    await sendEmail(deps, {
      to: user.email,
      template: EMAIL_TEMPLATES.verification,
      payload: { name: user.name, url },
    });
  },
  // A user without a password gets the invitation wording for the same set-password link.
  sendPasswordResetEmail: async ({ user, url, purpose }) => {
    await sendEmail(deps, {
      to: user.email,
      template:
        purpose === "invitation"
          ? EMAIL_TEMPLATES.accountInvitation
          : EMAIL_TEMPLATES.passwordReset,
      payload: { name: user.name, url },
    });
  },
});
