"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { useAbility } from "@repo/permissions/react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { SearchInput } from "@repo/ui/components/composed/search-input";
import { GENERAL_STATUSES, listBranchesSchema } from "@repo/validation";

import { ClientBranchesTable } from "@/features/branches/components/client-branches-table";
import type { BranchRow } from "@/features/branches/types";
import { parseSearchParams } from "@/hooks/search-params";
import { useSearch } from "@/hooks/use-search";
import { useTableState } from "@/hooks/use-table-state";
import { useTRPC } from "@/lib/trpc/react";

// Loaded when a row's chevron is pressed, not with the page.
const BranchDetailDialog = dynamic(
  () =>
    import("@/features/branches/components/branch-detail-dialog").then(
      (module) => module.BranchDetailDialog,
    ),
  { ssr: false },
);

/**
 * The client detail's 就業先部署情報 (legacy ClientBranches): the client's branches in every status
 * (the legacy clientBranches ignored it), searched and paged (10 a page) through the page's URL, a
 * row opening in a dialog. The client detail page hands it to `ClientDetailContainer`: features do
 * not import each other, the page composes them. Nothing for a caller who may not read branches.
 */
export const ClientBranchesContainer = ({ clientId }: { clientId: string }) => {
  const trpc = useTRPC();
  const canRead = useAbility().can("read", "Branch");
  const { searchParams, setMany } = useSearch();
  const input = useMemo(
    () => ({
      // Ten rows a page, as the legacy clientBranches (`take` 10).
      perPage: 10,
      ...parseSearchParams(listBranchesSchema, searchParams),
      clientId,
      statuses: [...GENERAL_STATUSES],
    }),
    [searchParams, clientId],
  );
  const branches = useQuery(
    trpc.branch.list.queryOptions(input, { placeholderData: keepPreviousData, enabled: canRead }),
  );
  const { pagination } = useTableState(branches.data);
  const [opened, setOpened] = useState<BranchRow | null>(null);

  if (!canRead) {
    return null;
  }
  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        value={input.search ?? ""}
        onSearch={(search) => {
          setMany({ search });
        }}
        label="番号・名前・担当者で検索"
        className="max-w-xs"
      />
      {branches.isError ? (
        <Alert variant="destructive">
          <AlertTitle>就業先部署を読み込めませんでした</AlertTitle>
          <AlertDescription>{branches.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <ClientBranchesTable
        data={branches.data?.items}
        isLoading={branches.isPending}
        pagination={pagination}
        onOpen={setOpened}
      />
      {opened ? (
        <BranchDetailDialog
          branch={opened}
          onOpenChange={(open) => {
            if (!open) {
              setOpened(null);
            }
          }}
        />
      ) : null}
    </div>
  );
};
