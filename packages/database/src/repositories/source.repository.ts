import type { Prisma } from "../generated/prisma/client";
import type { DbClient } from "../utils/transaction";

const REGION_SELECT = { code: true, name: true, area: true } satisfies Prisma.SourceRegionSelect;
const PREFECTURE_SELECT = {
  code: true,
  name: true,
  regionCode: true,
} satisfies Prisma.SourcePrefectureSelect;
const ADDRESS_SELECT = {
  postCode: true,
  pref: true,
  city: true,
  town: true,
} satisfies Prisma.SourceAddressSelect;

/** A region (地域) as the pickers show it: code, name and its area (エリア). */
export type SourceRegionOption = Prisma.SourceRegionGetPayload<{ select: typeof REGION_SELECT }>;
/** A prefecture (都道府県) with the region it belongs to. */
export type SourcePrefectureOption = Prisma.SourcePrefectureGetPayload<{
  select: typeof PREFECTURE_SELECT;
}>;
/** The address parts of one post code (Japan Post master). */
export type SourceAddressParts = Prisma.SourceAddressGetPayload<{ select: typeof ADDRESS_SELECT }>;

/** Read-only access to the seeded reference data (ADR 0005); nothing writes it at runtime. */
export const createSourceRepository = (db: DbClient) => ({
  findRegions: (): Promise<SourceRegionOption[]> =>
    db.sourceRegion.findMany({ select: REGION_SELECT, orderBy: { code: "asc" } }),

  findPrefectures: (): Promise<SourcePrefectureOption[]> =>
    db.sourcePrefecture.findMany({ select: PREFECTURE_SELECT, orderBy: { code: "asc" } }),

  /** `postCode` is seven digits (the form's hyphen is gone by then). */
  findAddressByPostCode: (postCode: string): Promise<SourceAddressParts | null> =>
    db.sourceAddress.findUnique({ where: { postCode }, select: ADDRESS_SELECT }),
});

export type SourceRepository = ReturnType<typeof createSourceRepository>;
