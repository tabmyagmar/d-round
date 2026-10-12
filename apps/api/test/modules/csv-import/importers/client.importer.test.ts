import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClientRepository } from "@repo/database";

import * as clientService from "../../../../src/modules/client/client.service";
import {
  clientInput,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
  uniqueEmployeeNumber,
} from "../../../support";
import type { SignedInUser, TestHarness } from "../../../support";
import { checkedRows, importValidRows, startImport } from "../csv-flow";

let h: TestHarness;
let charger: SignedInUser;

beforeAll(async () => {
  h = await createHarness();
  await ensureTestPostCode(h);
  charger = await signedInUser(h, { role: "am" });
});

afterAll(async () => {
  await h.stop();
});

const HEADER =
  "クライアント番号（必須）,クライアント名（必須）,クライアント名（カタカナ）（必須）,エリア（必須）,地区（必須）,担当者メールアドレス（必須）,郵便番号（必須）,住所（必須）,電話番号（必須）,FAX,URL,受注区分（必須）";

type ClientLine = {
  number: string;
  name: string;
  chargers: string;
  url: string;
  orderTypes: string;
};

const clientLine = (overrides: Partial<ClientLine> = {}) => {
  const line: ClientLine = {
    number: String(uniqueEmployeeNumber()),
    name: "株式会社テスト",
    chargers: charger.email,
    url: "",
    orderTypes: "派遣,業務請負",
    ...overrides,
  };
  return {
    ...line,
    text: [
      line.number,
      line.name,
      "カブシキガイシャテスト",
      "東日本",
      "南関東",
      line.chargers,
      "160-0022",
      "1-2-3",
      "03-1111-1111",
      "",
      line.url,
      `"${line.orderTypes}"`,
    ].join(","),
  };
};

const adminContext = async () => contextFor(h, (await signedInUser(h, { role: "admin" })).headers);

describe("クライアント CSV", () => {
  it("checks the client form's rules, a taken クライアント番号 and the 担当者", async () => {
    const ctx = await adminContext();
    const existing = await clientService.create(ctx, clientInput([charger.user.id]));
    const csvImport = await startImport(
      h,
      ctx,
      [
        HEADER,
        clientLine().text,
        clientLine({ number: String(existing.number) }).text,
        clientLine({ chargers: "nobody@example.com" }).text,
        clientLine({ url: "not a url", orderTypes: "派遣,委託" }).text,
      ].join("\r\n"),
      "CLIENT_CREATE",
    );

    expect((await checkedRows(h, csvImport.id)).map((row) => row.errors)).toEqual([
      [],
      [`クライアント番号: ${String(existing.number)} 既に登録されています`],
      ["担当者メールアドレス: nobody@example.com 登録されていません"],
      [
        "URL: 有効なURLを入力してください（例: example.com または https://example.com）",
        "受注区分: 「委託」は使えません（業務請負、派遣、スポット）",
      ],
    ]);
  });

  it("creates each confirmed client and updates one found by クライアント番号", async () => {
    const ctx = await adminContext();
    const created = clientLine();
    const addImport = await startImport(
      h,
      ctx,
      [HEADER, created.text].join("\r\n"),
      "CLIENT_CREATE",
    );
    await checkedRows(h, addImport.id);
    const [added] = await importValidRows(h, ctx, addImport.id);

    const repo = createClientRepository(h.db);
    expect(await repo.findById(added?.entityId ?? "")).toMatchObject({
      number: Number(created.number),
      orderTypes: ["CONTRACT_WORK", "DISPATCH"],
      chargers: [expect.objectContaining({ userId: charger.user.id })],
    });

    const renamed = clientLine({ number: created.number, name: "株式会社改名" });
    const unknown = clientLine();
    const updateImport = await startImport(
      h,
      ctx,
      [HEADER, renamed.text, unknown.text].join("\r\n"),
      "CLIENT_UPDATE",
    );
    expect((await checkedRows(h, updateImport.id)).map((row) => row.errors)).toEqual([
      [],
      [`クライアント番号: ${unknown.number} のクライアントが見つかりません`],
    ]);
    const [updated] = await importValidRows(h, ctx, updateImport.id);
    expect(updated).toMatchObject({ result: "IMPORTED", entityId: added?.entityId });
    expect((await repo.findById(added?.entityId ?? ""))?.name).toBe("株式会社改名");
  });
});
