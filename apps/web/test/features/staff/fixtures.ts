import type { StaffRow } from "@/features/staff/types";

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
