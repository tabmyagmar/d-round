import { EMAIL_TEMPLATES } from "@repo/queue";
import type { EmailTemplatePayloads } from "@repo/queue";
import { z } from "@repo/validation";

import type { MailMessage } from "./mail-provider";

/**
 * Renders an outbox row (template name + JSON payload) into a mail. Unknown templates or
 * malformed payloads are permanent failures: retrying cannot fix them.
 */

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

export type RenderedMail = Omit<MailMessage, "to">;

/** What the templates call the application (the MAIL_FROM display name, see mail-from.ts). */
export type MailBrand = { appName: string };

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const verificationPayload = z.object({ name: z.string().min(1), url: z.url() });

const renderVerification = (
  payload: EmailTemplatePayloads["verification-email"],
  brand: MailBrand,
): RenderedMail => ({
  subject: `Confirm your ${brand.appName} account`,
  text: [
    `Hi ${payload.name},`,
    "",
    `Confirm your email address to activate your ${brand.appName} account:`,
    payload.url,
    "",
    "The link is valid for one hour. If you did not create an account, ignore this message.",
  ].join("\n"),
  html: [
    `<p>Hi ${escapeHtml(payload.name)},</p>`,
    `<p>Confirm your email address to activate your ${escapeHtml(brand.appName)} account:</p>`,
    `<p><a href="${escapeHtml(payload.url)}">Confirm email</a></p>`,
    "<p>The link is valid for one hour. If you did not create an account, ignore this message.</p>",
  ].join("\n"),
});

export const renderEmail = (template: string, payload: unknown, brand: MailBrand): RenderedMail => {
  switch (template) {
    case EMAIL_TEMPLATES.verification: {
      const parsed = verificationPayload.safeParse(payload);
      if (!parsed.success) {
        throw new TemplateError(`Invalid payload for ${template}: ${parsed.error.message}`);
      }
      return renderVerification(parsed.data, brand);
    }
    default:
      throw new TemplateError(`Unknown email template: ${template}`);
  }
};
