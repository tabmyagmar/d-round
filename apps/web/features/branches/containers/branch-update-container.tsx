"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Skeleton } from "@repo/ui/components/skeleton";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { href, routes } from "@/config/routes";
import { BranchForm } from "@/features/branches/components/form/branch-form";
import { branchValuesOf } from "@/features/branches/utils/branch-form-input";
import { branchSaveErrorOf } from "@/features/branches/utils/branch-labels";
import { useTRPC } from "@/lib/trpc/react";

/**
 * 就業先部署編集: loads the branch, saves the whole form with `branch.update` (the 担当者 replaced; it
 * may move to another client), then back to the list with the legacy toast, as the legacy form did.
 * The branch's own client and 担当者 stay on offer, so they are named whatever the lookups return.
 */
export const BranchUpdateContainer = ({ branchId }: { branchId: string }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const branch = useQuery(trpc.branch.byId.queryOptions({ branchId }));
  const hierarchy = useSourceHierarchy();
  const chargers = useQuery(trpc.user.chargerOptions.queryOptions({}));
  const update = useMutation(
    trpc.branch.update.mutationOptions({
      onSuccess: async () => {
        toast.success("就業先部署が更新されました");
        await queryClient.invalidateQueries(trpc.branch.pathFilter());
        router.push(href(routes.branch.list));
      },
      onError: (error) => {
        toast.error(branchSaveErrorOf(error));
      },
    }),
  );

  if (branch.isPending) {
    return <Skeleton className="mx-auto h-64 w-full max-w-4xl" />;
  }
  if (branch.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>就業先部署情報を読み込めませんでした</AlertTitle>
        <AlertDescription>{branch.error.message}</AlertDescription>
      </Alert>
    );
  }

  const detail = branch.data;
  const offered = chargers.data ?? [];
  const chargerOptions = [
    ...offered,
    ...detail.chargers
      .map((charger) => charger.user)
      .filter((user) => !offered.some((option) => option.id === user.id)),
  ];
  return (
    <BranchForm
      // A refetch after saving resets the form to the stored values.
      key={detail.updatedAt.toISOString()}
      title="就業先部署編集"
      defaultValues={branchValuesOf(detail)}
      hierarchy={hierarchy}
      findClients={(search) => queryClient.query(trpc.client.options.queryOptions({ search }))}
      storedClient={{ id: detail.client.id, name: detail.client.name }}
      chargerOptions={chargerOptions}
      chargersLoading={chargers.isPending}
      findAddress={(postCode) =>
        queryClient.query(trpc.source.addressByPostCode.queryOptions({ postCode }))
      }
      cancelHref={href(routes.branch.list)}
      submitLabel="保存"
      pendingLabel="保存中…"
      pending={update.isPending}
      onSubmit={(input) => {
        update.mutate({ branchId, ...input });
      }}
    />
  );
};
