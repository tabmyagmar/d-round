import type { CommentTemplateRow } from "@/features/comment-templates/types";

/** A `commentTemplate.list` row as the API returns it (superjson keeps the dates). */
export const commentTemplateRow = (
  overrides: Partial<CommentTemplateRow> = {},
): CommentTemplateRow => ({
  id: crypto.randomUUID(),
  createdBy: "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e",
  types: ["WORKFLOW"],
  short: "承認",
  content: "承認します。",
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 1),
  ...overrides,
});
