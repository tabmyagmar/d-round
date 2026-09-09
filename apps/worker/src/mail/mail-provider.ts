/**
 * The only thing the worker knows about "sending mail". SMTP (Mailpit in dev) implements it
 * for real; the in-memory provider is for tests. Production providers (SES, Postmark, ...)
 * plug in here without touching the processor.
 */
export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailSendResult = {
  /** Provider message id, when it gives one. */
  messageId?: string;
};

export type MailProvider = {
  send: (message: MailMessage) => Promise<MailSendResult>;
  close?: () => Promise<void> | void;
};

/** Failures the provider knows will never succeed (bad address, rejected template). */
export class PermanentMailError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PermanentMailError";
  }
}
