"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { listCommentTemplatesSchema } from "@repo/validation";

import type { CommentTemplateDialogTarget } from "@/features/comment-templates/components/comment-template-dialog";
import { CommentTemplatesTable } from "@/features/comment-templates/components/comment-templates-table";
import { CommentTemplatesToolbar } from "@/features/comment-templates/components/comment-templates-toolbar";
import { CommentTemplatesStoreProvider } from "@/features/comment-templates/stores/comment-templates-store-provider";
import { parseSearchParams } from "@/hooks/search-params";
import { useSearch } from "@/hooks/use-search";
import { useTableState } from "@/hooks/use-table-state";
import { useTRPC } from "@/lib/trpc/react";

// Loaded when 新規作成, 定型文編集 or a delete is chosen, not with the list.
const CommentTemplateDialog = dynamic(
  () =>
    import("@/features/comment-templates/components/comment-template-dialog").then(
      (module) => module.CommentTemplateDialog,
    ),
  { ssr: false },
);
const CommentTemplateDeleteDialog = dynamic(
  () =>
    import("@/features/comment-templates/components/comment-template-delete-dialog").then(
      (module) => module.CommentTemplateDeleteDialog,
    ),
  { ssr: false },
);

/**
 * 定型文管理: the caller's own templates. The URL holds the search and the page, read through the
 * API's input schema; the selection lives in the list's store (table + 削除).
 */
export const CommentTemplatesContainer = () => {
  const trpc = useTRPC();
  const { searchParams, setMany } = useSearch();
  const input = useMemo(
    () => parseSearchParams(listCommentTemplatesSchema, searchParams),
    [searchParams],
  );
  const templates = useQuery(
    trpc.commentTemplate.list.queryOptions(input, { placeholderData: keepPreviousData }),
  );
  const { pagination } = useTableState(templates.data);
  const [dialogTarget, setDialogTarget] = useState<CommentTemplateDialogTarget | null>(null);
  const [deleteIds, setDeleteIds] = useState<readonly string[] | null>(null);

  return (
    <CommentTemplatesStoreProvider>
      <div className="flex flex-col gap-4">
        <CommentTemplatesToolbar
          search={input.search ?? ""}
          onSearch={(search) => {
            setMany({ search });
          }}
          onCreate={() => {
            setDialogTarget({ mode: "create" });
          }}
          onDeleteSelected={setDeleteIds}
        />
        {templates.isError ? (
          <Alert variant="destructive">
            <AlertTitle>定型文一覧を読み込めませんでした</AlertTitle>
            <AlertDescription>{templates.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <CommentTemplatesTable
          data={templates.data?.items}
          isLoading={templates.isPending}
          pagination={pagination}
          onEdit={(template) => {
            setDialogTarget({ mode: "edit", template });
          }}
          onDelete={(template) => {
            setDeleteIds([template.id]);
          }}
        />
        {dialogTarget ? (
          <CommentTemplateDialog
            target={dialogTarget}
            onOpenChange={(open) => {
              if (!open) {
                setDialogTarget(null);
              }
            }}
          />
        ) : null}
        {deleteIds ? (
          <CommentTemplateDeleteDialog
            ids={deleteIds}
            onOpenChange={(open) => {
              if (!open) {
                setDeleteIds(null);
              }
            }}
          />
        ) : null}
      </div>
    </CommentTemplatesStoreProvider>
  );
};
