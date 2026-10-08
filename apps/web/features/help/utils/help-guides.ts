/** A document 操作方法 offers for download. */
export type HelpGuide = {
  id: string;
  name: string;
  version: number;
  /** As shown, YYYY/MM/DD. */
  updatedAt: string;
  /** Served from `apps/web/public` (git-ignored, placed by the deployment). */
  fileUrl: string;
};

/** The legacy list (`HelpContainer`'s `initialData`), static as romuten-v3's help data. */
export const HELP_GUIDES: readonly HelpGuide[] = [
  {
    id: "guidebook",
    name: "DROUNDガイド",
    version: 1,
    updatedAt: "2025/12/22",
    fileUrl: "/help/guidebook.pdf",
  },
];
