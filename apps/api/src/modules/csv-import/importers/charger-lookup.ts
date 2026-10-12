import { createUserRepository } from "@repo/database";
import type { Role } from "@repo/validation";

import type { RequestContext } from "../../../core/context";

/**
 * 担当者メールアドレス → the users they name, as the forms offer 担当者: active, never a
 * super_admin (`assertChargersActive`), and — when the record has 地域 — covering one of them
 * (the スタッフ form's choice; the legacy `validateChargerRegionRelation`).
 */
export type ChargerLookup = {
  /** The user of an address, or the reason it cannot be the record's 担当者. */
  resolve: (email: string, regionCodes?: readonly number[]) => { id: string } | { error: string };
};

const SUPER_ADMIN: Role = "super_admin";

export const lookupChargers = async (
  ctx: RequestContext,
  emails: readonly string[],
  label = "担当者メールアドレス",
): Promise<ChargerLookup> => {
  const users = await createUserRepository(ctx.db).findWithRegionsByEmails([...new Set(emails)], {
    role: { not: SUPER_ADMIN },
  });
  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  return {
    resolve: (email, regionCodes) => {
      const user = byEmail.get(email.toLowerCase());
      if (!user) {
        return { error: `${label}: ${email} 登録されていません` };
      }
      const covered = new Set(user.profile?.regions.map((region) => region.regionCode));
      if (regionCodes && !regionCodes.some((code) => covered.has(code))) {
        return { error: `${label}: ${email} は選択した地域に紐づいていません` };
      }
      return { id: user.id };
    },
  };
};
