import type { PermissionCatalog } from "@/features/users/types";

/** Two groups of the real catalog's shape (keys and labels from permissions.csv). */
export const CATALOG: PermissionCatalog = [
  {
    key: "1100",
    name: "User",
    nameJp: "マスタ管理",
    children: [
      {
        key: "1101",
        name: "User create",
        nameJp: "担当者新規登録",
        action: "create",
        modelName: "User",
        roles: ["admin", "super_admin"],
      },
      {
        key: "1102",
        name: "User read",
        nameJp: "担当者情報の一覧・詳細を確認",
        action: "read",
        modelName: "User",
        roles: ["admin", "super_admin"],
      },
    ],
  },
  {
    key: "1200",
    name: "Client",
    nameJp: "クライアント管理",
    children: [
      {
        key: "1202",
        name: "Client read",
        nameJp: "クライアント情報の一覧・詳細を確認",
        action: "read",
        modelName: "Client",
        roles: ["admin", "am", "manager", "super_admin"],
      },
      {
        key: "1203",
        name: "Client update",
        nameJp: "クライアント情報編集",
        action: "update",
        modelName: "Client",
        roles: ["admin", "super_admin"],
      },
    ],
  },
];
