/**
 * A failed save as the legacy said it: a 就業先番号 the client already uses (the legacy form had no
 * pre-check and relied on this message), otherwise the API's message.
 */
export const branchSaveErrorOf = (error: {
  message: string;
  data?: { code: string } | null | undefined;
}): string =>
  error.data?.code === "CONFLICT"
    ? "入力された就業先番号はすでに登録済みです。内容を再度ご確認ください"
    : error.message;
