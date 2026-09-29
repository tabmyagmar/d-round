/**
 * MAIL_FROM carries the brand: `My App <no-reply@example.com>`. The display name is what the
 * templates call the application; without one the bare address is used.
 */
export const mailDisplayName = (from: string): string => {
  const match = /^\s*(?:"([^"]*)"|([^<]*?))\s*<([^>]+)>\s*$/.exec(from);
  if (!match) {
    return from.trim();
  }
  const name = (match[1] ?? match[2] ?? "").trim();
  return name || (match[3] ?? "").trim();
};
