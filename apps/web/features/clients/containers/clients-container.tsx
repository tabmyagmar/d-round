"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { listClientsSchema } from "@repo/validation";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { ClientsTable } from "@/features/clients/components/list/clients-table";
import { ClientsToolbar } from "@/features/clients/components/list/clients-toolbar";
import type { ClientRow } from "@/features/clients/types";
import { clientFiltersOf } from "@/features/clients/utils/client-filters";
import { parseSearchParams } from "@/hooks/search-params";
import { useSearch } from "@/hooks/use-search";
import { useTableState } from "@/hooks/use-table-state";
import { useTRPC } from "@/lib/trpc/react";
import { RowSelectionProvider, useRowSelection } from "@/stores/row-selection";

// Loaded when ステータス変更 or a delete is chosen, not with the list.
const ClientStatusDialog = dynamic(
  () =>
    import("@/features/clients/components/client-status-dialog").then(
      (module) => module.ClientStatusDialog,
    ),
  { ssr: false },
);
const ClientDeleteDialog = dynamic(
  () =>
    import("@/features/clients/components/client-delete-dialog").then(
      (module) => module.ClientDeleteDialog,
    ),
  { ssr: false },
);

/** The list inside its row selection: deleted clients leave the selection. */
const ClientsList = () => {
  const trpc = useTRPC();
  const { searchParams, setMany } = useSearch();
  const input = useMemo(() => parseSearchParams(listClientsSchema, searchParams), [searchParams]);
  const clients = useQuery(
    trpc.client.list.queryOptions(input, { placeholderData: keepPreviousData }),
  );
  const { sorting, pagination } = useTableState(clients.data);
  const setRowSelection = useRowSelection((store) => store.setRowSelection);
  const [statusTarget, setStatusTarget] = useState<ClientRow | null>(null);
  const [deleteIds, setDeleteIds] = useState<readonly string[] | null>(null);
  const filters = clientFiltersOf(input);
  // Region names for the tags; fetched only while that filter is in effect.
  const hierarchy = useSourceHierarchy(filters.regionCodes.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <ClientsToolbar
        filters={filters}
        names={hierarchy}
        onChange={setMany}
        onDeleteSelected={setDeleteIds}
      />
      {clients.isError ? (
        <Alert variant="destructive">
          <AlertTitle>クライアント一覧を読み込めませんでした</AlertTitle>
          <AlertDescription>{clients.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <ClientsTable
        data={clients.data?.items}
        isLoading={clients.isPending}
        sorting={sorting}
        pagination={pagination}
        onChangeStatus={setStatusTarget}
        onDelete={(client) => {
          setDeleteIds([client.id]);
        }}
      />
      {statusTarget ? (
        <ClientStatusDialog
          client={statusTarget}
          onOpenChange={(open) => {
            if (!open) {
              setStatusTarget(null);
            }
          }}
        />
      ) : null}
      {deleteIds ? (
        <ClientDeleteDialog
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
 * クライアント管理: the URL is the list's state (search, filters, page, sort), read through the
 * API's own input schema; the previous page stays on screen while the next one loads.
 */
export const ClientsContainer = () => (
  <RowSelectionProvider>
    <ClientsList />
  </RowSelectionProvider>
);
