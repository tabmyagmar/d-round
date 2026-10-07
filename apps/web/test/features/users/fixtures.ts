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
  role: "staff",
  banned: false,
  banReason: null,
  banExpires: null,
  deletedAt: null,
  lastName: "山田",
  firstName: "太郎",
  lastNameKana: "ヤマダ",
  firstNameKana: "タロウ",
  ...overrides,
});
