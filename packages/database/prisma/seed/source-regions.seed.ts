// Japan regions from the legacy d-round master (data/source-regions.csv). Diff-based upsert by
// `code`: missing rows are created, changed rows updated, identical rows left untouched.
import { SourceArea } from "../../src/index";

import { diffByKey, parseInteger, readCsv } from "./support";
import type { SeedFn } from "./support";

const SOURCE_REGION_COLUMNS = ["code", "name", "nameEn", "area"] as const;
type SourceRegionCsvRow = Record<(typeof SOURCE_REGION_COLUMNS)[number], string>;
type SourceRegionRow = { code: number; name: string; nameEn: string; area: SourceArea };

const SOURCE_REGIONS_CSV = new URL("./data/source-regions.csv", import.meta.url);
const SOURCE_AREAS = Object.values<string>(SourceArea);

const isSourceArea = (value: string): value is SourceArea => SOURCE_AREAS.includes(value);

const toRegionRow = (row: SourceRegionCsvRow): SourceRegionRow => {
  if (!isSourceArea(row.area)) {
    throw new Error(`source-regions.csv: unknown area "${row.area}" for code ${row.code}`);
  }
  return {
    code: parseInteger(row.code, "code"),
    name: row.name,
    nameEn: row.nameEn,
    area: row.area,
  };
};

const isSameRegion = (a: SourceRegionRow, b: SourceRegionRow): boolean =>
  a.name === b.name && a.nameEn === b.nameEn && a.area === b.area;

export const seedSourceRegions: SeedFn = async (prisma) => {
  const desired = readCsv(SOURCE_REGIONS_CSV, SOURCE_REGION_COLUMNS).map(toRegionRow);
  const existing = await prisma.sourceRegion.findMany({
    select: { code: true, name: true, nameEn: true, area: true },
  });
  const { toCreate, toUpdate } = diffByKey(existing, desired, (row) => row.code, isSameRegion);

  const { count: created } = await prisma.sourceRegion.createMany({
    data: toCreate,
    skipDuplicates: true,
  });
  for (const { code, ...data } of toUpdate) {
    await prisma.sourceRegion.update({ where: { code }, data });
  }

  return {
    dataset: "source_regions",
    rows: desired.length,
    created,
    updated: toUpdate.length,
    skipped: 0,
  };
};
