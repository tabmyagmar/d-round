import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createStaffRepository } from "@repo/database";

import * as staffService from "../../../../src/modules/staff/staff.service";
import {
  TEST_POST_CODE,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
  staffInput,
  uniqueEmployeeNumber,
} from "../../../support";
import type { SignedInUser, TestHarness } from "../../../support";
import { checkedRows, importValidRows, startImport } from "../csv-flow";

let h: TestHarness;
let charger: SignedInUser;

beforeAll(async () => {
  h = await createHarness();
  await ensureTestPostCode(h);
  // A 担当者 of 南関東 (region 4), whom the rows below name.
  charger = await signedInUser(h, { role: "am", profile: { regionCodes: [4] } });
});

afterAll(async () => {
  await h.stop();
});

const CREATE_HEADER =
  "雇用区分（必須）,スタッフ番号（必須）,姓（必須）,名（必須）,セイ（必須）,メイ（必須）,エリア（必須）,地域（必須）,都道府県（必須）,担当者メールアドレス（必須）,支店名（必須）,役職（必須）,生年月日（必須）,性別（必須）,郵便番号（必須）,住所（必須）,電話番号（必須）,緊急連絡先（電話番号）,メールアドレス,入社日（必須）,退職日,退職理由";
const UPDATE_HEADER = CREATE_HEADER.split(",").slice(0, 19).join(",");

type StaffLine = {
  employeeNumber: string;
  regions: string;
  chargers: string;
  branchName: string;
  birthday: string;
  postCode: string;
  phoneNumber: string;
};

const staffLine = (overrides: Partial<StaffLine> = {}, { update = false } = {}) => {
  const line: StaffLine = {
    employeeNumber: String(uniqueEmployeeNumber()),
    regions: "南関東",
    chargers: charger.email,
    branchName: "新宿支店",
    birthday: "1990/4/1",
    postCode: "160-0022",
    phoneNumber: "03-1111-1111",
    ...overrides,
  };
  const cells = [
    "正社員",
    line.employeeNumber,
    "佐藤",
    "花子",
    "サトウ",
    "ハナコ",
    "東日本",
    line.regions,
    "東京都",
    `"${line.chargers}"`,
    line.branchName,
    "スタッフ",
    line.birthday,
    "女性",
    line.postCode,
    "1-2-3",
    line.phoneNumber,
    "",
    "",
  ];
  return { ...line, text: (update ? cells : [...cells, "2025/4/1", "", ""]).join(",") };
};

const adminContext = async () => contextFor(h, (await signedInUser(h, { role: "admin" })).headers);

describe("スタッフ CSV: 追加", () => {
  it("checks each row against the staff form's rules and the 担当者 of its 地域", async () => {
    const ctx = await adminContext();
    const existing = await staffService.create(ctx, staffInput([charger.user.id]));
    const valid = staffLine();
    const csvImport = await startImport(
      h,
      ctx,
      [
        CREATE_HEADER,
        valid.text,
        staffLine({ employeeNumber: String(existing.employeeNumber) }).text,
        staffLine({ postCode: "999-9999" }).text,
        staffLine({ chargers: "nobody@example.com" }).text,
        staffLine({ regions: "北海道" }).text,
        staffLine({ birthday: "2020/1/1", phoneNumber: "12" }).text,
      ].join("\r\n"),
      "STAFF_CREATE",
    );

    const rows = await checkedRows(h, csvImport.id);

    expect(rows.map((row) => row.errors)).toEqual([
      [],
      [`スタッフ番号: ${String(existing.employeeNumber)} 既に登録されています`],
      ["郵便番号: 999-9999 が見つかりません"],
      ["担当者メールアドレス: nobody@example.com 登録されていません"],
      [`担当者メールアドレス: ${charger.email.toLowerCase()} は選択した地域に紐づいていません`],
      ["生年月日: 16歳以上である必要があります。", "電話番号を入力してください"],
    ]);
  });

  it("creates the staff of each confirmed row, with its 在籍情報 and 担当者", async () => {
    const ctx = await adminContext();
    const line = staffLine();
    const csvImport = await startImport(
      h,
      ctx,
      [CREATE_HEADER, line.text].join("\r\n"),
      "STAFF_CREATE",
    );
    await checkedRows(h, csvImport.id);

    const [row] = await importValidRows(h, ctx, csvImport.id);

    expect(row).toMatchObject({ result: "IMPORTED" });
    const staff = await createStaffRepository(h.db).findById(row?.entityId ?? "");
    expect(staff).toMatchObject({
      employeeNumber: Number(line.employeeNumber),
      lastName: "佐藤",
      gender: "FEMALE",
      position: "STAFF",
      phoneNumber: "03-1111-1111",
      address: { postCode: TEST_POST_CODE, address1: "1-2-3" },
    });
    expect(staff?.jobHistories.map((job) => job.resignationDate)).toEqual([null]);
    expect(staff?.chargers.map((assigned) => assigned.userId)).toEqual([charger.user.id]);
  });
});

describe("スタッフ CSV: 更新", () => {
  it("changes what the CSV carries and keeps the staff's 在籍情報, 家族情報 and メモ", async () => {
    const ctx = await adminContext();
    const existing = await staffService.create(
      ctx,
      staffInput([charger.user.id], {
        memos: [{ memoType: "STAFF_MEMO", content: "大事なメモ" }],
      }),
    );
    const unknown = uniqueEmployeeNumber();
    const csvImport = await startImport(
      h,
      ctx,
      [
        UPDATE_HEADER,
        staffLine(
          { employeeNumber: String(existing.employeeNumber), branchName: "渋谷支店" },
          { update: true },
        ).text,
        staffLine({ employeeNumber: String(unknown) }, { update: true }).text,
      ].join("\r\n"),
      "STAFF_UPDATE",
    );

    expect((await checkedRows(h, csvImport.id)).map((row) => row.errors)).toEqual([
      [],
      [`スタッフ番号: ${String(unknown)} のスタッフが見つかりません`],
    ]);
    const [updated] = await importValidRows(h, ctx, csvImport.id);

    expect(updated).toMatchObject({ result: "IMPORTED", entityId: existing.id });
    const staff = await createStaffRepository(h.db).findById(existing.id);
    expect(staff).toMatchObject({
      branchName: "渋谷支店",
      lastName: "佐藤",
      phoneNumber: "03-1111-1111",
    });
    expect(staff?.jobHistories).toHaveLength(existing.jobHistories.length);
    expect(staff?.familyMembers.map((member) => member.firstName)).toEqual(
      existing.familyMembers.map((member) => member.firstName),
    );
    expect(staff?.memos.map((memo) => memo.content)).toEqual(["大事なメモ"]);
  });
});
