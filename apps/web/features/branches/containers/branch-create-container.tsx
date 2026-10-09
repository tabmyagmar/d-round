"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { href, routes } from "@/config/routes";
import { BranchForm } from "@/features/branches/components/form/branch-form";
import { emptyBranchValues } from "@/features/branches/utils/branch-form-input";
import { branchSaveErrorOf } from "@/features/branches/utils/branch-labels";
import { useTRPC } from "@/lib/trpc/react";

/**
 * 就業先部署追加 (`branch.create`), then back to the list with the legacy toast. The form searches
 * the clients, fills 就業先番号 with the chosen client's next number and looks up the address through
 * the lookups passed here; the 担当者 on offer are every active user, as the legacy chargerUsers.
 */
export const BranchCreateContainer = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const hierarchy = useSourceHierarchy();
  const chargers = useQuery(trpc.user.chargerOptions.queryOptions({}));
  const [defaultValues] = useState(emptyBranchValues);

  const create = useMutation(
    trpc.branch.create.mutationOptions({
      onSuccess: async () => {
        toast.success("就業先部署作成");
        await queryClient.invalidateQueries(trpc.branch.pathFilter());
        router.push(href(routes.branch.list));
      },
      onError: (error) => {
        toast.error(branchSaveErrorOf(error));
      },
    }),
  );

  return (
    <BranchForm
      title="就業先部署登録"
      defaultValues={defaultValues}
      hierarchy={hierarchy}
      findClients={(search) => queryClient.query(trpc.client.options.queryOptions({ search }))}
      findNextNumber={(clientId) =>
        queryClient.query(trpc.branch.nextNumber.queryOptions({ clientId }, { staleTime: 0 }))
      }
      chargerOptions={chargers.data ?? []}
      chargersLoading={chargers.isPending}
      findAddress={(postCode) =>
        queryClient.query(trpc.source.addressByPostCode.queryOptions({ postCode }))
      }
      cancelHref={href(routes.branch.list)}
      submitLabel="追加"
      pendingLabel="追加中…"
      pending={create.isPending}
      onSubmit={(input) => {
        create.mutate(input);
      }}
    />
  );
};
