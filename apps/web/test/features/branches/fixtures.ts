import type { BranchRow } from "@/features/branches/types";

const CREATED = new Date("2026-10-01T00:00:00Z");

/**
 * A `branch.list` / `branch.byId` row as the API returns it: 就業先番号 3 新宿店 of 株式会社テスト,
 * 東日本 / 南関東, 営業部 at 〒160-0022 東京都新宿区新宿1-2-3, 連絡担当者 山田 太郎, one 担当者.
 */
export const branchRow = (overrides: Partial<BranchRow> = {}): BranchRow => {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    clientId: "client-1",
    number: 3,
    name: "新宿店",
    nameKana: "シンジュクテン",
    area: "EAST",
    regionCode: 4,
    departmentNumber: 10,
    departmentName: "営業部",
    departmentNameKana: "エイギョウブ",
    departmentFax: null,
    contactLastName: "山田",
    contactFirstName: "太郎",
    contactLastNameKana: "ヤマダ",
    contactFirstNameKana: "タロウ",
    contactPosition: "LEADER",
    contactEmail: "yamada@example.com",
    memo: null,
    status: "ACTIVE",
    createdAt: CREATED,
    updatedAt: CREATED,
    deletedAt: null,
    client: { id: "client-1", number: 101, name: "株式会社テスト" },
    region: { name: "南関東" },
    address: {
      id: crypto.randomUUID(),
      branchId: id,
      postCode: "1600022",
      address1: "1-2-3",
      createdAt: CREATED,
      updatedAt: CREATED,
      sourceAddress: { pref: "東京都", city: "新宿区", town: "新宿" },
    },
    chargers: [
      {
        branchId: id,
        userId: "charger-1",
        createdAt: CREATED,
        user: { id: "charger-1", name: "佐藤 一郎" },
      },
    ],
    ...overrides,
  };
};
