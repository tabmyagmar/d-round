import type { ClientDetail, ClientRow } from "@/features/clients/types";

const CREATED = new Date("2026-10-01T00:00:00Z");

/**
 * A `client.list` row as the API returns it: クライアント番号 101 株式会社テスト, 東日本, 派遣,
 * 〒160-0022 東京都新宿区新宿1-2-3, one 担当者.
 */
export const clientRow = (overrides: Partial<ClientRow> = {}): ClientRow => {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    number: 101,
    name: "株式会社テスト",
    nameKana: "カブシキガイシャテスト",
    areas: ["EAST"],
    orderTypes: ["DISPATCH"],
    phoneNumber: "03-1234-5678",
    fax: null,
    webUrl: null,
    status: "ACTIVE",
    createdAt: CREATED,
    updatedAt: CREATED,
    deletedAt: null,
    address: {
      id: crypto.randomUUID(),
      clientId: id,
      postCode: "1600022",
      address1: "1-2-3",
      createdAt: CREATED,
      updatedAt: CREATED,
      sourceAddress: { pref: "東京都", city: "新宿区", town: "新宿" },
    },
    chargers: [
      {
        clientId: id,
        userId: "charger-1",
        createdAt: CREATED,
        user: { id: "charger-1", name: "佐藤 一郎" },
      },
    ],
    ...overrides,
  };
};

/** `client.byId` for the same client, with its region 南関東. */
export const clientDetail = (overrides: Partial<ClientDetail> = {}): ClientDetail => {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    ...clientRow({ id }),
    regions: [{ clientId: id, regionCode: 4, createdAt: CREATED, region: { name: "南関東" } }],
    ...overrides,
  };
};
