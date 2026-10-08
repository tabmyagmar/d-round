import type { StaffDetail, StaffRow } from "@/features/staff/types";

const CREATED = new Date("2026-10-01T00:00:00Z");

/** A `staff.list` row as the API returns it: スタッフ番号 101, 東日本, 南関東, one 担当者. */
export const staffRow = (overrides: Partial<StaffRow> = {}): StaffRow => {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    employeeType: "PART_TIME",
    employeeNumber: 101,
    lastName: "山田",
    firstName: "花子",
    lastNameKana: "ヤマダ",
    firstNameKana: "ハナコ",
    gender: "FEMALE",
    birthday: new Date("1990-04-01T00:00:00Z"),
    position: "STAFF",
    branchName: "新宿支店",
    email: null,
    phoneNumber: "090-1234-5678",
    emergencyPhoneNumber: null,
    areas: ["EAST"],
    status: "ACTIVE",
    createdAt: CREATED,
    updatedAt: CREATED,
    deletedAt: null,
    regions: [{ staffId: id, regionCode: 4, createdAt: CREATED, region: { name: "南関東" } }],
    chargers: [
      {
        id: crypto.randomUUID(),
        staffId: id,
        userId: "charger-1",
        createdAt: CREATED,
        unassignedAt: null,
        user: { id: "charger-1", name: "佐藤 一郎" },
      },
    ],
    ...overrides,
  };
};

/** A charger row as `staff.byId` returns it: assigned at `from`, unassigned at `to` (or not). */
export const chargerRow = (
  staffId: string,
  name: string,
  from: string,
  to: string | null = null,
): StaffDetail["chargers"][number] => {
  const userId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    staffId,
    userId,
    createdAt: new Date(from),
    unassignedAt: to === null ? null : new Date(to),
    user: { id: userId, name },
  };
};

/**
 * `staff.byId` for スタッフ番号 101 山田 花子: 〒160-0022 東京都新宿区新宿, 東京都, one 担当者 now
 * and one before, one employment period, no family members or memos.
 */
export const staffDetail = (overrides: Partial<StaffDetail> = {}): StaffDetail => {
  const id = overrides.id ?? crypto.randomUUID();
  const { chargers: _listChargers, ...row } = staffRow({ id });
  return {
    ...row,
    address: {
      id: crypto.randomUUID(),
      staffId: id,
      postCode: "1600022",
      address1: "1-2-3",
      createdAt: CREATED,
      updatedAt: CREATED,
      sourceAddress: { pref: "東京都", city: "新宿区", town: "新宿" },
    },
    prefectures: [
      { staffId: id, prefectureCode: 13, createdAt: CREATED, prefecture: { name: "東京都" } },
    ],
    chargers: [
      chargerRow(id, "前任 太郎", "2026-01-05T00:00:00Z", "2026-06-30T00:00:00Z"),
      chargerRow(id, "佐藤 一郎", "2026-07-01T00:00:00Z"),
    ],
    familyMembers: [],
    memos: [],
    jobHistories: [
      {
        id: crypto.randomUUID(),
        staffId: id,
        sortOrder: 0,
        hireDate: new Date("2026-04-01T00:00:00Z"),
        resignationDate: null,
        resignationReason: null,
        createdAt: CREATED,
        updatedAt: CREATED,
      },
    ],
    ...overrides,
  };
};
