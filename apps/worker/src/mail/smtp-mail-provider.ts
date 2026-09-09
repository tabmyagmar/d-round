import { createTransport } from "nodemailer";
import type { Transporter } from "nodemailer";

import type { MailMessage, MailProvider, MailSendResult } from "./mail-provider";

export type SmtpMailProviderOptions = {
  /** smtp://user:pass@host:port — Mailpit in dev: smtp://localhost:1025 */
  smtpUrl: string;
  from: string;
};

/** nodemailer over SMTP. Retryable errors bubble up so BullMQ retries with backoff. */
export const createSmtpMailProvider = (options: SmtpMailProviderOptions): MailProvider => {
  const transporter: Transporter = createTransport(options.smtpUrl);

  return {
    send: async (message: MailMessage): Promise<MailSendResult> => {
      const info = (await transporter.sendMail({
        from: options.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html === undefined ? {} : { html: message.html }),
      })) as { messageId?: string };
      return info.messageId === undefined ? {} : { messageId: info.messageId };
    },
    close: () => {
      transporter.close();
    },
  };
};
