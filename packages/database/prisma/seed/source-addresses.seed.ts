// Japan Post postal-code master from the legacy d-round seed (data/source-addresses.csv.gz,
// 124,809 rows, 120,663 distinct post codes). Insert-only: the first CSV row of a post code wins,
// as the legacy MySQL LOAD DATA LOCAL did against its unique index, and rows already in the table
// are never updated (createMany skipDuplicates). A master refresh is a separate ticket (ADR 0005).
// The post codes already in the table are read first and only missing rows are sent to createMany,
// because Prisma's cost grows with the rows sent: a re-run is one read instead of a full pass.
import type { SourceAddress } from "../../src/index";

import { chunk, emptyToNull, parseFlag, parseInteger, readCsv } from "./support";
import type { SeedFn } from "./support";

// The legacy header, `id` included; the autoincrement id is not ported (UUID v7 ids instead).
const SOURCE_ADDRESS_COLUMNS = [
  "id",
  "jisCode",
  "oldPostCode",
  "postCode",
  "prefKana",
  "cityKana",
  "townKana",
  "pref",
  "city",
  "town",
  "isTownRepresentedByMultiplePostalCodes",
  "isHamletNumberingStart",
  "hasChome",
  "isPostalCodeForMultipleTownAreas",
  "updateStatus",
  "changeReason",
] as const;
type SourceAddressCsvRow = Record<(typeof SOURCE_ADDRESS_COLUMNS)[number], string>;
type SourceAddressRow = Omit<SourceAddress, "id" | "createdAt" | "updatedAt">;

const SOURCE_ADDRESSES_CSV = new URL("./data/source-addresses.csv.gz", import.meta.url);

// About 18 bind parameters per row, far below Postgres's 65,535 per statement. No transaction
// spans the chunks, so an interrupted run resumes where it stopped on the next run.
const CHUNK_SIZE = 1_000;

const toAddressRow = (row: SourceAddressCsvRow): SourceAddressRow => ({
  jisCode: parseInteger(row.jisCode, "jisCode"),
  oldPostCode: emptyToNull(row.oldPostCode),
  postCode: row.postCode,
  prefKana: emptyToNull(row.prefKana),
  cityKana: emptyToNull(row.cityKana),
  townKana: emptyToNull(row.townKana),
  pref: row.pref,
  city: row.city,
  town: row.town,
  isTownRepresentedByMultiplePostalCodes: parseFlag(
    row.isTownRepresentedByMultiplePostalCodes,
    "isTownRepresentedByMultiplePostalCodes",
  ),
  isHamletNumberingStart: parseFlag(row.isHamletNumberingStart, "isHamletNumberingStart"),
  hasChome: parseFlag(row.hasChome, "hasChome"),
  isPostalCodeForMultipleTownAreas: parseFlag(
    row.isPostalCodeForMultipleTownAreas,
    "isPostalCodeForMultipleTownAreas",
  ),
  updateStatus: parseInteger(row.updateStatus, "updateStatus"),
  changeReason: parseInteger(row.changeReason, "changeReason"),
});

/** Keeps the first row of every post code, in CSV order. */
const firstPerPostCode = (rows: readonly SourceAddressRow[]): SourceAddressRow[] => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.postCode)) {
      return false;
    }
    seen.add(row.postCode);
    return true;
  });
};

export const seedSourceAddresses: SeedFn = async (prisma) => {
  // Every row is converted before deduplication, so a malformed duplicate still fails the seed.
  const rows = readCsv(SOURCE_ADDRESSES_CSV, SOURCE_ADDRESS_COLUMNS).map(toAddressRow);
  const distinct = firstPerPostCode(rows);
  const existing = await prisma.sourceAddress.findMany({ select: { postCode: true } });
  const present = new Set(existing.map((row) => row.postCode));
  const missing = distinct.filter((row) => !present.has(row.postCode));

  // skipDuplicates still guards against a concurrent run inserting the same post codes meanwhile.
  let created = 0;
  for (const slice of chunk(missing, CHUNK_SIZE)) {
    const { count } = await prisma.sourceAddress.createMany({ data: slice, skipDuplicates: true });
    created += count;
  }

  return {
    dataset: "source_addresses",
    rows: distinct.length,
    created,
    updated: 0,
    skipped: rows.length - distinct.length,
  };
};
