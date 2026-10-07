/**
 * Better Auth answers with an error `code` (and our rate limiter with HTTP 429); the auth forms
 * show these Japanese messages instead of the library's English text. PASSWORD_POLICY already
 * carries the Japanese message of the violated rule (the server-side policy hook).
 */
export type AuthClientError = {
  code?: string | undefined;
  status: number;
  message?: string | undefined;
};

const GENERIC = "問題が発生しました。もう一度お試しください。";

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "メールアドレスまたはパスワードが正しくありません",
  BANNED_USER: "現在のアカウントではログインできません。",
  EMAIL_NOT_VERIFIED:
    "メールアドレスの確認が完了していません。「パスワードを忘れた方はこちら」からパスワードを設定してください",
  INVALID_PASSWORD: "現在のパスワードが正しくありません",
  INVALID_TOKEN: "URLの有効期限が切れているか、すでに使用されています",
};

export const authErrorMessage = (error: AuthClientError): string => {
  if (error.status === 429) {
    return "試行回数が多すぎます。しばらく時間をおいて再度お試しください";
  }
  if (error.code === "PASSWORD_POLICY" && error.message) {
    return error.message;
  }
  return (error.code ? MESSAGES[error.code] : undefined) ?? GENERIC;
};
