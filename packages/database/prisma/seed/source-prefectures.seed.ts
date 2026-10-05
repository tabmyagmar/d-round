// Japan prefectures from the legacy d-round master (data/source-prefectures.csv). Diff-based
// upsert by `code`, writing the scalar `regionCode` (no nested connect): runs after the regions
// seed, and a code with no region fails on the foreign key instead of being skipped.
import { diffByKey, parseInteger, readCsv } from "./support";
import type { SeedFn } from "./support";

type SourcePrefectureCsvRow = { code: string; name: string; nameEn: string; regionCode: string };
type SourcePrefectureRow = { code: number; name: string; nameEn: string; regionCode: number };

const SOURCE_PREFECTURES_CSV = new URL("./data/source-prefectures.csv", import.meta.url);

const toPrefectureRow = (row: SourcePrefectureCsvRow): SourcePrefectureRow => ({
  code: parseInteger(row.code, "code"),
  name: row.name,
  nameEn: row.nameEn,
  regionCode: parseInteger(row.regionCode, "regionCode"),
});

const isSamePrefecture = (a: SourcePrefectureRow, b: SourcePrefectureRow): boolean =>
  a.name === b.name && a.nameEn === b.nameEn && a.regionCode === b.regionCode;

export const seedSourcePrefectures: SeedFn = async (prisma) => {
  const desired = readCsv<SourcePrefectureCsvRow>(SOURCE_PREFECTURES_CSV).map(toPrefectureRow);
  const existing = await prisma.sourcePrefecture.findMany({
    select: { code: true, name: true, nameEn: true, regionCode: true },
  });
  const { toCreate, toUpdate } = diffByKey(existing, desired, (row) => row.code, isSamePrefecture);

  const { count: created } = await prisma.sourcePrefecture.createMany({
    data: toCreate,
    skipDuplicates: true,
  });
  for (const { code, ...data } of toUpdate) {
    await prisma.sourcePrefecture.update({ where: { code }, data });
  }

  return {
    dataset: "source_prefectures",
    rows: desired.length,
    created,
    updated: toUpdate.length,
    skipped: 0,
  };
};
