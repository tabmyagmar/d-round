import {
  createBranchRepository,
  createClientRepository,
  createSourceRepository,
} from "@repo/database";
import { createBranchSchema, formatPostCode, updateBranchSchema } from "@repo/validation";
import { AREA_BY_LABEL, branchCreateCsv, branchUpdateCsv } from "@repo/validation/csv";
import type { BranchCsvRow } from "@repo/validation/csv";

import type { RequestContext } from "../../../core/context";
import { ValidationError } from "../../../core/errors";
import * as branchService from "../../branch/branch.service";
import { errorsByLine } from "../csv-importer";
import type { CsvImporter } from "../csv-importer";

import { lookupChargers } from "./charger-lookup";

/**
 * 就業先部署 CSV rows go through the branch service — `create` and `update` — so the branch form's
 * rules hold (legacy `branch-csv-*`). A row names its クライアント by クライアント番号; an update
 * finds its 就業先部署 by クライアント番号 and 就業先番号 and keeps its メモ, which the CSV does not carry.
 */

type Located = { clientId: string | undefined; branchId: string | undefined };

/** Each row's クライアント, and its 就業先部署 when one holds the 就業先番号 there. */
const locate = async (ctx: RequestContext, rows: readonly BranchCsvRow[]) => {
  const clients = new Map(
    (
      await createClientRepository(ctx.db).findActiveByNumbers(rows.map((row) => row.clientNumber))
    ).map((client) => [client.number, client.id]),
  );
  const branches = await createBranchRepository(ctx.db).findActiveByClientIds([
    ...new Set(clients.values()),
  ]);
  return (row: BranchCsvRow): Located => {
    const clientId = clients.get(row.clientNumber);
    const branch = branches.find(
      (candidate) => candidate.clientId === clientId && candidate.number === row.number,
    );
    return { clientId, branchId: branch?.id };
  };
};

const clientNotFound = (row: BranchCsvRow) =>
  `クライアント番号: ${String(row.clientNumber)} のクライアントが見つかりません`;
const branchNotFound = (row: BranchCsvRow) =>
  `就業先番号: ${String(row.number)} の就業先部署が見つかりません`;

const labelOfArea = (area: string) =>
  Object.entries(AREA_BY_LABEL).find(([, code]) => code === area)?.[0] ?? area;

/** The checks both types share: 地域 in the エリア, the post code, each 担当者 an active user. */
const checkReferences = async (
  ctx: RequestContext,
  rows: readonly { lineNumber: number; row: BranchCsvRow }[],
  add: (lineNumber: number, message: string) => void,
) => {
  const source = createSourceRepository(ctx.db);
  const [regions, known, chargers] = await Promise.all([
    source.findRegions(),
    source.findKnownPostCodes(rows.map(({ row }) => row.postCode)),
    lookupChargers(
      ctx,
      rows.flatMap(({ row }) => row.chargerEmails),
    ),
  ]);
  const postCodes = new Set(known);
  for (const { lineNumber, row } of rows) {
    const region = regions.find((candidate) => candidate.code === row.regionCode);
    if (region && region.area !== row.area) {
      add(lineNumber, `地区: 「${region.name}」は${labelOfArea(row.area)}の地域ではありません`);
    }
    if (!postCodes.has(row.postCode)) {
      add(lineNumber, `郵便番号: ${formatPostCode(row.postCode)} が見つかりません`);
    }
    for (const email of row.chargerEmails) {
      const charger = chargers.resolve(email);
      if ("error" in charger) {
        add(lineNumber, charger.error);
      }
    }
  }
};

/** The branch input of a row for its クライアント; an address that no longer fits refuses it. */
const inputOf = async (ctx: RequestContext, row: BranchCsvRow, clientId: string) => {
  const chargers = await lookupChargers(ctx, row.chargerEmails);
  const chargerUserIds = row.chargerEmails.map((email) => {
    const charger = chargers.resolve(email);
    if ("error" in charger) {
      throw new ValidationError(charger.error);
    }
    return charger.id;
  });
  return {
    clientId,
    number: row.number,
    name: row.name,
    nameKana: row.nameKana,
    area: row.area,
    regionCode: row.regionCode,
    chargerUserIds,
    departmentNumber: row.departmentNumber,
    departmentName: row.departmentName,
    departmentNameKana: row.departmentNameKana,
    departmentFax: row.departmentFax,
    address: { postCode: row.postCode, address1: row.address1 },
    contactLastName: row.contactLastName,
    contactFirstName: row.contactFirstName,
    contactLastNameKana: row.contactLastNameKana,
    contactFirstNameKana: row.contactFirstNameKana,
    contactPosition: row.contactPosition,
    contactEmail: row.contactEmail,
  };
};

export const branchCreateImporter: CsvImporter<BranchCsvRow> = {
  definition: branchCreateCsv,

  check: async (ctx, rows) => {
    const { errors, add } = errorsByLine();
    const where = await locate(
      ctx,
      rows.map(({ row }) => row),
    );
    for (const { lineNumber, row } of rows) {
      const located = where(row);
      if (!located.clientId) {
        add(lineNumber, clientNotFound(row));
      } else if (located.branchId) {
        add(lineNumber, `就業先番号: ${String(row.number)} 既に登録されています`);
      }
    }
    await checkReferences(ctx, rows, add);
    return errors;
  },

  importRow: async (ctx, row) => {
    const { clientId } = (await locate(ctx, [row]))(row);
    if (!clientId) {
      throw new ValidationError(clientNotFound(row));
    }
    const input = createBranchSchema.parse({ ...(await inputOf(ctx, row, clientId)), memo: null });
    return (await branchService.create(ctx, input)).id;
  },
};

export const branchUpdateImporter: CsvImporter<BranchCsvRow> = {
  definition: branchUpdateCsv,

  check: async (ctx, rows) => {
    const { errors, add } = errorsByLine();
    const where = await locate(
      ctx,
      rows.map(({ row }) => row),
    );
    for (const { lineNumber, row } of rows) {
      const located = where(row);
      if (!located.clientId) {
        add(lineNumber, clientNotFound(row));
      } else if (!located.branchId) {
        add(lineNumber, branchNotFound(row));
      }
    }
    await checkReferences(ctx, rows, add);
    return errors;
  },

  importRow: async (ctx, row) => {
    const { clientId, branchId } = (await locate(ctx, [row]))(row);
    const current = branchId ? await createBranchRepository(ctx.db).findById(branchId) : null;
    if (!clientId || !current) {
      throw new ValidationError(clientId ? branchNotFound(row) : clientNotFound(row));
    }
    const input = updateBranchSchema.parse({
      branchId: current.id,
      ...(await inputOf(ctx, row, clientId)),
      memo: current.memo,
    });
    return (await branchService.update(ctx, input)).id;
  },
};
