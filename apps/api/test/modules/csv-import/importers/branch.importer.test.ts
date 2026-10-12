import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createBranchRepository } from "@repo/database";

import * as branchService from "../../../../src/modules/branch/branch.service";
import * as clientService from "../../../../src/modules/client/client.service";
import {
  branchInput,
  clientInput,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
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
  "クライアント番号（必須）,就業先番号（必須）,就業先名（必須）,就業先名（カタカナ）（必須）,部署番号（必須）,部署名（必須）,部署名（カタカナ）（必須）,エリア（必須）,地区（必須）,担当者メールアドレス（必須）,郵便番号（必須）,住所（必須）,FAX,姓（必須）,名（必須）,セイ（必須）,メイ（必須）,役職（必須）,メールアドレス（必須）";

type BranchLine = {
  clientNumber: string;
  number: string;
  name: string;
  area: string;
  region: string;
};

const branchLine = (overrides: Partial<BranchLine> & { clientNumber: string }) => {
  const line: BranchLine = {
    number: "101",
    name: "新宿店",
    area: "東日本",
    region: "南関東",
    ...overrides,
  };
  return [
    line.clientNumber,
    line.number,
    line.name,
    "シンジュクテン",
    "11",
    "営業部",
    "エイギョウブ",
    line.area,
    line.region,
    charger.email,
    "160-0022",
    "1-2-3",
    "",
    "田中",
    "健一",
    "タナカ",
    "ケンイチ",
    "正社員",
    "contact@example.com",
  ].join(",");
};

const setUp = async () => {
  const ctx = await contextFor(h, (await signedInUser(h, { role: "admin" })).headers);
  const client = await clientService.create(ctx, clientInput([charger.user.id]));
  return { ctx, client, clientNumber: String(client.number) };
};

describe("就業先部署 CSV", () => {
  it("checks the クライアント, a 就業先番号 taken within it, the 地域's エリア and repeats", async () => {
    const { ctx, client, clientNumber } = await setUp();
    await branchService.create(ctx, branchInput(client.id, [charger.user.id], { number: 7 }));
    const csvImport = await startImport(
      h,
      ctx,
      [
        HEADER,
        branchLine({ clientNumber }),
        branchLine({ clientNumber, number: "7" }),
        branchLine({ clientNumber: "999999999", number: "8" }),
        branchLine({ clientNumber, number: "9", area: "西日本" }),
        branchLine({ clientNumber }),
      ].join("\r\n"),
      "BRANCH_CREATE",
    );

    expect((await checkedRows(h, csvImport.id)).map((row) => row.errors)).toEqual([
      [],
      ["就業先番号: 7 既に登録されています"],
      ["クライアント番号: 999999999 のクライアントが見つかりません"],
      ["地区: 「南関東」は西日本の地域ではありません"],
      [`クライアント番号・就業先番号: ${clientNumber}-101 CSV内で重複しています`],
    ]);
  });

  it("creates a 就業先部署 of its クライアント and updates one, keeping its メモ", async () => {
    const { ctx, client, clientNumber } = await setUp();
    const existing = await branchService.create(
      ctx,
      branchInput(client.id, [charger.user.id], { number: 5, memo: "残すメモ" }),
    );
    const addImport = await startImport(
      h,
      ctx,
      [HEADER, branchLine({ clientNumber, number: "6" })].join("\r\n"),
      "BRANCH_CREATE",
    );
    await checkedRows(h, addImport.id);
    const [added] = await importValidRows(h, ctx, addImport.id);
    const repo = createBranchRepository(h.db);
    expect(await repo.findById(added?.entityId ?? "")).toMatchObject({
      clientId: client.id,
      number: 6,
      departmentName: "営業部",
      contactPosition: "FULL_TIME_EMPLOYEE",
    });

    const updateImport = await startImport(
      h,
      ctx,
      [
        HEADER,
        branchLine({ clientNumber, number: "5", name: "渋谷店" }),
        branchLine({ clientNumber, number: "50" }),
      ].join("\r\n"),
      "BRANCH_UPDATE",
    );
    expect((await checkedRows(h, updateImport.id)).map((row) => row.errors)).toEqual([
      [],
      ["就業先番号: 50 の就業先部署が見つかりません"],
    ]);
    const [updated] = await importValidRows(h, ctx, updateImport.id);
    expect(updated).toMatchObject({ result: "IMPORTED", entityId: existing.id });
    expect(await repo.findById(existing.id)).toMatchObject({ name: "渋谷店", memo: "残すメモ" });
  });
});
