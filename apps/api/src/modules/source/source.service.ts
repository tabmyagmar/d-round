import { createSourceRepository } from "@repo/database";
import type {
  SourceAddressParts,
  SourcePrefectureOption,
  SourceRegionOption,
} from "@repo/database";

import type { RequestContext } from "../../core/context";
import { ForbiddenError } from "../../core/errors";

/**
 * Reference data (ADR 0005): the regions and prefectures behind the エリア → 地域 → 都道府県
 * pickers and the post-code lookup behind 住所検索. Every signed-in user reads it (the `Source`
 * rule, ADR 0003); nothing writes it at runtime.
 */

const assertMayRead = (ctx: RequestContext): void => {
  if (!ctx.ability.can("read", "Source")) {
    throw new ForbiddenError("Not allowed to read reference data");
  }
};

export const regions = async (ctx: RequestContext): Promise<SourceRegionOption[]> => {
  assertMayRead(ctx);
  return createSourceRepository(ctx.db).findRegions();
};

export const prefectures = async (ctx: RequestContext): Promise<SourcePrefectureOption[]> => {
  assertMayRead(ctx);
  return createSourceRepository(ctx.db).findPrefectures();
};

/** The address parts of a seven-digit post code, or `null` when Japan Post has none. */
export const addressByPostCode = async (
  ctx: RequestContext,
  postCode: string,
): Promise<SourceAddressParts | null> => {
  assertMayRead(ctx);
  return createSourceRepository(ctx.db).findAddressByPostCode(postCode);
};
