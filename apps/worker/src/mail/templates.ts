import { EMAIL_TEMPLATES } from "@repo/queue";
import type { EmailTemplate } from "@repo/queue";
import { z } from "@repo/validation";

import { buttonRow, cautionRow, renderLayout, textRows } from "./layout";
import type { MailMessage } from "./mail-provider";

/**
 * Renders an outbox row (template name + JSON payload) into a mail. Unknown templates or
 * malformed payloads are permanent failures: retrying cannot fix them. Copy is the legacy
 * d-round wording; every template has the same shape (greeting, intro, button, notes), so one
 * definition renders both the HTML and the plain-text part.
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

/** All three templates carry the recipient's name and the link to open. */
const linkPayload = z.object({ name: z.string().min(1), url: z.url() });
type LinkPayload = z.infer<typeof linkPayload>;

type TemplateCopy = {
  subject: string;
  eyebrow: string;
  title: string;
  intro: string;
  buttonLabel: string;
  notes: readonly string[];
  footerNote: string;
};

const EXPIRY_NOTE = "※このURLはセキュリティ保護のため、発行から【1時間】以内にご利用ください。";
const IGNORE_NOTE = "※お心当たりのない場合は、本メールを破棄してください。";

const COPY: Record<EmailTemplate, (appName: string) => TemplateCopy> = {
  [EMAIL_TEMPLATES.passwordReset]: (appName) => ({
    subject: `「${appName}」アカウント パスワード再設定のご案内`,
    eyebrow: "パスワード再設定",
    title: "パスワード再設定のご案内",
    intro: `下記のボタンから、${appName}アカウントのパスワードを再設定してください。`,
    buttonLabel: "パスワード再設定画面へ",
    notes: [
      EXPIRY_NOTE,
      "※有効期限が過ぎた場合は、ログイン画面の「パスワードをお忘れの方」から再度お手続きください。",
      IGNORE_NOTE,
    ],
    footerNote: "このメールは、パスワードの再設定をリクエストされた方に自動送信しております。",
  }),
  [EMAIL_TEMPLATES.accountInvitation]: (appName) => ({
    subject: `「${appName}」ご利用登録のお知らせ`,
    eyebrow: "アカウント登録",
    title: "ご利用登録のお知らせ",
    intro: `${appName}のアカウントが作成されました。下記のボタンからパスワードを設定し、ご利用を開始してください。`,
    buttonLabel: "パスワード設定画面へ",
    notes: [
      EXPIRY_NOTE,
      "※有効期限が過ぎた場合は、管理者に再送を依頼するか、ログイン画面の「パスワードをお忘れの方」からお手続きください。",
    ],
    footerNote: `本メールは${appName}にご登録いただいた方に自動送信しております。`,
  }),
  [EMAIL_TEMPLATES.verification]: (appName) => ({
    subject: `「${appName}」メールアドレス確認のお願い`,
    eyebrow: "メールアドレス確認",
    title: "メールアドレス確認のお願い",
    intro: `下記のボタンから、${appName}アカウントのメールアドレスを確認してください。`,
    buttonLabel: "メールアドレスを確認する",
    notes: [EXPIRY_NOTE, IGNORE_NOTE],
    footerNote: "このメールは、メールアドレスの確認が必要な方に自動送信しております。",
  }),
};

const render = (copy: TemplateCopy, payload: LinkPayload, brand: MailBrand): RenderedMail => {
  const greeting = `${payload.name}様`;
  return {
    subject: copy.subject,
    html: renderLayout({
      appName: brand.appName,
      eyebrow: copy.eyebrow,
      title: copy.title,
      footerNote: copy.footerNote,
      rows: [
        textRows([greeting, copy.intro]),
        buttonRow(payload.url, copy.buttonLabel),
        cautionRow(copy.notes),
      ].join(""),
    }),
    text: [
      greeting,
      "",
      copy.intro,
      "",
      `${copy.buttonLabel}:`,
      payload.url,
      "",
      ...copy.notes,
      "",
      "--",
      copy.footerNote,
    ].join("\n"),
  };
};

// Own keys only: `in` would also accept inherited names such as `toString`.
const isTemplate = (value: string): value is EmailTemplate => Object.hasOwn(COPY, value);

export const renderEmail = (template: string, payload: unknown, brand: MailBrand): RenderedMail => {
  if (!isTemplate(template)) {
    throw new TemplateError(`Unknown email template: ${template}`);
  }
  const parsed = linkPayload.safeParse(payload);
  if (!parsed.success) {
    throw new TemplateError(`Invalid payload for ${template}: ${parsed.error.message}`);
  }
  return render(COPY[template](brand.appName), parsed.data, brand);
};
