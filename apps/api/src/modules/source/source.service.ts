import { createSourceRepository } from "@repo/database";
import type {
  DbClient,
  SourceAddressParts,
  SourcePrefectureOption,
  SourceRegionOption,
} from "@repo/database";

import type { RequestContext } from "../../core/context";
import { ForbiddenError, ValidationError } from "../../core/errors";

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

/** Reference data a write names: region and prefecture codes, a seven-digit post code. */
export type SourceReferences = {
  regionCodes?: readonly number[];
  prefectureCodes?: readonly number[];
  postCode?: string;
};

/**
 * Refuses a write that names a region, prefecture or post code the reference data lacks (one
 * `ValidationError` naming every unknown code), before a foreign key would. Used by the スタッフ,
 * クライアント and 就業先部署 writes inside their transaction, so it takes that transaction's client
 * rather than a request context.
 */
export const assertKnownSource = async (
  db: DbClient,
  { regionCodes = [], prefectureCodes = [], postCode }: SourceReferences,
): Promise<void> => {
  const source = createSourceRepository(db);
  const unknown: string[] = [];
  if (regionCodes.length > 0) {
    const known = new Set((await source.findRegions()).map((region) => region.code));
    unknown.push(
      ...regionCodes.filter((code) => !known.has(code)).map((code) => `region ${String(code)}`),
    );
  }
  if (prefectureCodes.length > 0) {
    const known = new Set((await source.findPrefectures()).map((prefecture) => prefecture.code));
    unknown.push(
      ...prefectureCodes
        .filter((code) => !known.has(code))
        .map((code) => `prefecture ${String(code)}`),
    );
  }
  if (unknown.length > 0) {
    throw new ValidationError(`Unknown ${unknown.join(", ")}`);
  }
  if (postCode !== undefined && !(await source.findAddressByPostCode(postCode))) {
    throw new ValidationError(`Unknown post code ${postCode}`);
  }
};
