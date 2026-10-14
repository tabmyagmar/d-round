/**
 * アクセスログ (docs/adr/0015-audit-log.md): the names of what a row records. The API writes the keys,
 * the web shows the labels and filters by the keys.
 */

/** The kinds of target a row names, as the screens call them. */
export const AUDIT_ENTITY_TYPES = {
  User: "担当者",
  Staff: "スタッフ",
  Client: "クライアント",
  Branch: "就業先部署",
  CsvImport: "CSV取込",
  CsvExport: "CSVダウンロード",
  AuditLog: "アクセスログ",
} as const satisfies Record<string, string>;
export type AuditEntityType = keyof typeof AUDIT_ENTITY_TYPES;

type AuditActionDefinition = { label: string; entityType: AuditEntityType };

/**
 * Every action a row records, with its label (the legacy `MutationJpNameMap`, renamed after today's
 * screens). A mutation's key is its tRPC path, and a test fails for a mutation that is neither listed
 * here nor exempt (`meta({ audit: false })`); Better Auth's events are `auth.*`, the system's own
 * `system.*`.
 */
export const AUDIT_ACTIONS = {
  "user.invite": { label: "担当者追加", entityType: "User" },
  "user.update": { label: "担当者情報編集", entityType: "User" },
  "user.updateProfile": { label: "プロフィール更新", entityType: "User" },
  "user.deactivate": { label: "担当者利用停止", entityType: "User" },
  "user.reactivate": { label: "担当者利用再開", entityType: "User" },
  "user.sendPasswordReset": { label: "パスワード再設定メール送信", entityType: "User" },
  "staff.create": { label: "スタッフ追加", entityType: "Staff" },
  "staff.update": { label: "スタッフ情報編集", entityType: "Staff" },
  "staff.changeStatus": { label: "スタッフステータス変更", entityType: "Staff" },
  "staff.deleteMany": { label: "スタッフ削除", entityType: "Staff" },
  "client.create": { label: "クライアント追加", entityType: "Client" },
  "client.update": { label: "クライアント情報編集", entityType: "Client" },
  "client.changeStatus": { label: "クライアントステータス変更", entityType: "Client" },
  "client.deleteMany": { label: "クライアント削除", entityType: "Client" },
  "branch.create": { label: "就業先部署追加", entityType: "Branch" },
  "branch.update": { label: "就業先部署編集", entityType: "Branch" },
  "branch.changeStatus": { label: "就業先部署ステータス変更", entityType: "Branch" },
  "branch.deleteMany": { label: "就業先部署削除", entityType: "Branch" },
  "csvImport.create": { label: "CSVアップロード", entityType: "CsvImport" },
  "csvImport.confirm": { label: "CSVによる登録", entityType: "CsvImport" },
  "csvExport.create": { label: "CSVダウンロード", entityType: "CsvExport" },
  "csvExport.downloadUrl": { label: "CSV再ダウンロード", entityType: "CsvExport" },
  "auth.signIn": { label: "ログイン", entityType: "User" },
  "auth.signOut": { label: "ログアウト", entityType: "User" },
  "auth.changePassword": { label: "パスワード変更", entityType: "User" },
  "auth.requestPasswordReset": { label: "パスワードを忘れた", entityType: "User" },
  "auth.resetPassword": { label: "パスワード設定", entityType: "User" },
  "auth.admin": { label: "管理者API", entityType: "User" },
  "system.auditLogPurge": { label: "保存期間切れログ削除", entityType: "AuditLog" },
} as const satisfies Record<string, AuditActionDefinition>;
export type AuditAction = keyof typeof AUDIT_ACTIONS;

export const isAuditAction = (key: string): key is AuditAction => Object.hasOwn(AUDIT_ACTIONS, key);

/** Days a row is kept; the migration's trigger refuses to delete a younger one. */
export const AUDIT_LOG_RETENTION_DAYS = 90;

/**
 * One changed field of a row: its value before and after as the screens show it (null for none), or,
 * for a masked field, only that it changed.
 */
export type AuditChange =
  | { field: string; before: string | null; after: string | null; truncated?: true }
  | { field: string; masked: true };
