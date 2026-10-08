import type { UserRow } from "@/features/users/types";

/** A `user.list` row as the API returns it (superjson keeps the dates). */
export const userRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: crypto.randomUUID(),
  name: "山田 太郎",
  email: "yamada@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  role: "am",
  banned: false,
  banReason: null,
  banExpires: null,
  deletedAt: null,
  lastName: "山田",
  firstName: "太郎",
  lastNameKana: "ヤマダ",
  firstNameKana: "タロウ",
  profile: null,
  ...overrides,
});

/** A 担当者 profile as `user.list` / `user.byId` return it: 社員番号 12, 東日本, 南関東. */
export const userProfile = (
  overrides: Partial<NonNullable<UserRow["profile"]>> = {},
): NonNullable<UserRow["profile"]> => {
  const userId = overrides.userId ?? crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    userId,
    employeeNumber: 12,
    departmentName: "東日本営業部",
    position: "SV",
    retirementDate: null,
    areas: ["EAST"],
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    regions: [
      {
        userId,
        regionCode: 4,
        createdAt: new Date("2026-10-01T00:00:00Z"),
        region: { name: "南関東" },
      },
    ],
    ...overrides,
  };
};
