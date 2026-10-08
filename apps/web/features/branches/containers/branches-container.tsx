"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { listBranchesSchema } from "@repo/validation";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { BranchesTable } from "@/features/branches/components/list/branches-table";
import { BranchesToolbar } from "@/features/branches/components/list/branches-toolbar";
import type { BranchRow } from "@/features/branches/types";
import { branchFiltersOf } from "@/features/branches/utils/branch-filters";
import { parseSearchParams } from "@/hooks/search-params";
import { useSearch } from "@/hooks/use-search";
import { useTableState } from "@/hooks/use-table-state";
import { useTRPC } from "@/lib/trpc/react";
import { RowSelectionProvider, useRowSelection } from "@/stores/row-selection";

// Loaded when ステータス変更 or a delete is chosen, not with the list.
const BranchStatusDialog = dynamic(
  () =>
    import("@/features/branches/components/branch-status-dialog").then(
      (module) => module.BranchStatusDialog,
    ),
  { ssr: false },
);
const BranchDeleteDialog = dynamic(
  () =>
    import("@/features/branches/components/branch-delete-dialog").then(
      (module) => module.BranchDeleteDialog,
    ),
  { ssr: false },
);

/** The list inside its row selection: deleted branches leave the selection. */
const BranchesList = () => {
  const trpc = useTRPC();
  const { searchParams, setMany } = useSearch();
  const input = useMemo(() => parseSearchParams(listBranchesSchema, searchParams), [searchParams]);
  const branches = useQuery(
    trpc.branch.list.queryOptions(input, { placeholderData: keepPreviousData }),
  );
  const { sorting, pagination } = useTableState(branches.data);
  const setRowSelection = useRowSelection((store) => store.setRowSelection);
  const [statusTarget, setStatusTarget] = useState<BranchRow | null>(null);
  const [deleteIds, setDeleteIds] = useState<readonly string[] | null>(null);
  const filters = branchFiltersOf(input);
  // Region names for the tags; fetched only while that filter is in effect.
  const hierarchy = useSourceHierarchy(filters.regionCodes.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <BranchesToolbar
        filters={filters}
        names={hierarchy}
        onChange={setMany}
        onDeleteSelected={setDeleteIds}
      />
      {branches.isError ? (
        <Alert variant="destructive">
          <AlertTitle>就業先部署一覧を読み込めませんでした</AlertTitle>
          <AlertDescription>{branches.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <BranchesTable
        data={branches.data?.items}
        isLoading={branches.isPending}
        sorting={sorting}
        pagination={pagination}
        onChangeStatus={setStatusTarget}
        onDelete={(branch) => {
          setDeleteIds([branch.id]);
        }}
      />
      {statusTarget ? (
        <BranchStatusDialog
          branch={statusTarget}
          onOpenChange={(open) => {
            if (!open) {
              setStatusTarget(null);
            }
          }}
        />
      ) : null}
      {deleteIds ? (
        <BranchDeleteDialog
          ids={deleteIds}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteIds(null);
            }
          }}
          onDeleted={(ids) => {
            setRowSelection((selection) =>
              Object.fromEntries(Object.entries(selection).filter(([id]) => !ids.includes(id))),
            );
          }}
        />
      ) : null}
    </div>
  );
};

/**
 * 就業先部署: the URL is the list's state (search, filters, page, sort), read through the API's own
 * input schema; the previous page stays on screen while the next one loads.
 */
export const BranchesContainer = () => (
  <RowSelectionProvider>
    <BranchesList />
  </RowSelectionProvider>
);
