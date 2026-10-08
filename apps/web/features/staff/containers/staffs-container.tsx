"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { listStaffsSchema } from "@repo/validation";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { StaffsTable } from "@/features/staff/components/list/staffs-table";
import { StaffsToolbar } from "@/features/staff/components/list/staffs-toolbar";
import type { StaffRow } from "@/features/staff/types";
import { staffFiltersOf } from "@/features/staff/utils/staff-filters";
import { parseSearchParams } from "@/hooks/search-params";
import { useSearch } from "@/hooks/use-search";
import { useTableState } from "@/hooks/use-table-state";
import { useTRPC } from "@/lib/trpc/react";
import { RowSelectionProvider, useRowSelection } from "@/stores/row-selection";

// Loaded when ステータス変更 or a delete is chosen, not with the list.
const StaffStatusDialog = dynamic(
  () =>
    import("@/features/staff/components/staff-status-dialog").then(
      (module) => module.StaffStatusDialog,
    ),
  { ssr: false },
);
const StaffDeleteDialog = dynamic(
  () =>
    import("@/features/staff/components/staff-delete-dialog").then(
      (module) => module.StaffDeleteDialog,
    ),
  { ssr: false },
);

/**
 * The list inside its row selection: deleted staff leave the selection, so the list reads the
 * store too (the users list only writes it through the table).
 */
const StaffsList = () => {
  const trpc = useTRPC();
  const { searchParams, setMany } = useSearch();
  const input = useMemo(() => parseSearchParams(listStaffsSchema, searchParams), [searchParams]);
  const staffs = useQuery(
    trpc.staff.list.queryOptions(input, { placeholderData: keepPreviousData }),
  );
  const { sorting, pagination } = useTableState(staffs.data);
  const setRowSelection = useRowSelection((store) => store.setRowSelection);
  const [statusTarget, setStatusTarget] = useState<StaffRow | null>(null);
  const [deleteIds, setDeleteIds] = useState<readonly string[] | null>(null);
  const filters = staffFiltersOf(input);
  // Region and prefecture names for the tags; fetched only while those filters are in effect.
  const hierarchy = useSourceHierarchy(
    filters.regionCodes.length > 0 || filters.prefectureCodes.length > 0,
  );

  return (
    <div className="flex flex-col gap-4">
      <StaffsToolbar
        filters={filters}
        names={hierarchy}
        onChange={setMany}
        onDeleteSelected={setDeleteIds}
      />
      {staffs.isError ? (
        <Alert variant="destructive">
          <AlertTitle>スタッフ一覧を読み込めませんでした</AlertTitle>
          <AlertDescription>{staffs.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <StaffsTable
        data={staffs.data?.items}
        isLoading={staffs.isPending}
        sorting={sorting}
        pagination={pagination}
        onChangeStatus={setStatusTarget}
        onDelete={(staff) => {
          setDeleteIds([staff.id]);
        }}
      />
      {statusTarget ? (
        <StaffStatusDialog
          staff={statusTarget}
          onOpenChange={(open) => {
            if (!open) {
              setStatusTarget(null);
            }
          }}
        />
      ) : null}
      {deleteIds ? (
        <StaffDeleteDialog
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
 * スタッフ管理: the URL is the list's state (search, filters, page, sort), read through the API's
 * own input schema; the previous page stays on screen while the next one loads.
 */
export const StaffsContainer = () => (
  <RowSelectionProvider>
    <StaffsList />
  </RowSelectionProvider>
);
