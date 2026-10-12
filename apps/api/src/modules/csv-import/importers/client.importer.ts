import { createClientRepository, createSourceRepository } from "@repo/database";
import { createClientSchema, formatPostCode, updateClientSchema } from "@repo/validation";
import { clientCreateCsv, clientUpdateCsv } from "@repo/validation/csv";
import type { ClientCsvRow } from "@repo/validation/csv";

import type { RequestContext } from "../../../core/context";
import { ValidationError } from "../../../core/errors";
import * as clientService from "../../client/client.service";
import { errorsByLine } from "../csv-importer";
import type { CsvImporter } from "../csv-importer";

import { lookupChargers } from "./charger-lookup";

/**
 * クライアント CSV rows go through the client service — `create` and `update` — so the client
 * form's rules hold (legacy `client-csv-*`). An update replaces what the CSV carries, which is
 * every field of the form.
 */

/** The checks both types share: the post code in the master, each 担当者 an active user. */
const checkReferences = async (
  ctx: RequestContext,
  rows: readonly { lineNumber: number; row: ClientCsvRow }[],
  add: (lineNumber: number, message: string) => void,
) => {
  const [known, chargers] = await Promise.all([
    createSourceRepository(ctx.db).findKnownPostCodes(rows.map(({ row }) => row.postCode)),
    lookupChargers(
      ctx,
      rows.flatMap(({ row }) => row.chargerEmails),
    ),
  ]);
  const postCodes = new Set(known);
  for (const { lineNumber, row } of rows) {
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

/** The client input of a row; an address that no longer names an active user refuses it. */
const inputOf = async (ctx: RequestContext, row: ClientCsvRow) => {
  const chargers = await lookupChargers(ctx, row.chargerEmails);
  const chargerUserIds = row.chargerEmails.map((email) => {
    const charger = chargers.resolve(email);
    if ("error" in charger) {
      throw new ValidationError(charger.error);
    }
    return charger.id;
  });
  return {
    number: row.number,
    name: row.name,
    nameKana: row.nameKana,
    areas: row.areas,
    regionCodes: row.regionCodes,
    chargerUserIds,
    address: { postCode: row.postCode, address1: row.address1 },
    phoneNumber: row.phoneNumber,
    fax: row.fax,
    webUrl: row.webUrl,
    orderTypes: row.orderTypes,
  };
};

const clientsByNumber = async (ctx: RequestContext, numbers: readonly number[]) =>
  new Map(
    (await createClientRepository(ctx.db).findActiveByNumbers(numbers)).map((client) => [
      client.number,
      client.id,
    ]),
  );

const notFound = (number: number) =>
  `クライアント番号: ${String(number)} のクライアントが見つかりません`;

export const clientCreateImporter: CsvImporter<ClientCsvRow> = {
  definition: clientCreateCsv,

  check: async (ctx, rows) => {
    const { errors, add } = errorsByLine();
    const taken = await clientsByNumber(
      ctx,
      rows.map(({ row }) => row.number),
    );
    for (const { lineNumber, row } of rows) {
      if (taken.has(row.number)) {
        add(lineNumber, `クライアント番号: ${String(row.number)} 既に登録されています`);
      }
    }
    await checkReferences(ctx, rows, add);
    return errors;
  },

  importRow: async (ctx, row) => {
    const input = createClientSchema.parse(await inputOf(ctx, row));
    return (await clientService.create(ctx, input)).id;
  },
};

export const clientUpdateImporter: CsvImporter<ClientCsvRow> = {
  definition: clientUpdateCsv,

  check: async (ctx, rows) => {
    const { errors, add } = errorsByLine();
    const found = await clientsByNumber(
      ctx,
      rows.map(({ row }) => row.number),
    );
    for (const { lineNumber, row } of rows) {
      if (!found.has(row.number)) {
        add(lineNumber, notFound(row.number));
      }
    }
    await checkReferences(ctx, rows, add);
    return errors;
  },

  importRow: async (ctx, row) => {
    const clientId = (await clientsByNumber(ctx, [row.number])).get(row.number);
    if (!clientId) {
      throw new ValidationError(notFound(row.number));
    }
    const input = updateClientSchema.parse({ clientId, ...(await inputOf(ctx, row)) });
    return (await clientService.update(ctx, input)).id;
  },
};
