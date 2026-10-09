"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Skeleton } from "@repo/ui/components/skeleton";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { href, routes } from "@/config/routes";
import { ClientForm } from "@/features/clients/components/form/client-form";
import { clientValuesOf } from "@/features/clients/utils/client-form-input";
import { clientSaveErrorOf } from "@/features/clients/utils/client-labels";
import { useTRPC } from "@/lib/trpc/react";

/**
 * クライアント情報編集: loads the client, saves the whole form with `client.update` (regions and
 * 担当者 replaced), then back to the list with the legacy toast, as the legacy form did. The
 * client's own 担当者 stay on offer even when they are no longer active users.
 */
export const ClientUpdateContainer = ({ clientId }: { clientId: string }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const client = useQuery(trpc.client.byId.queryOptions({ clientId }));
  const hierarchy = useSourceHierarchy();
  const chargers = useQuery(trpc.user.chargerOptions.queryOptions({}));
  const update = useMutation(
    trpc.client.update.mutationOptions({
      onSuccess: async () => {
        toast.success("クライアントが更新されました");
        await queryClient.invalidateQueries(trpc.client.pathFilter());
        router.push(href(routes.client.list));
      },
      onError: (error) => {
        toast.error(clientSaveErrorOf(error));
      },
    }),
  );

  if (client.isPending) {
    return <Skeleton className="mx-auto h-64 w-full max-w-4xl" />;
  }
  if (client.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>クライアント情報を読み込めませんでした</AlertTitle>
        <AlertDescription>{client.error.message}</AlertDescription>
      </Alert>
    );
  }

  const detail = client.data;
  const offered = chargers.data ?? [];
  const chargerOptions = [
    ...offered,
    ...detail.chargers
      .map((charger) => charger.user)
      .filter((user) => !offered.some((option) => option.id === user.id)),
  ];
  return (
    <ClientForm
      // A refetch after saving resets the form to the stored values.
      key={detail.updatedAt.toISOString()}
      title="クライアント情報編集"
      defaultValues={clientValuesOf(detail)}
      hierarchy={hierarchy}
      chargerOptions={chargerOptions}
      chargersLoading={chargers.isPending}
      findAddress={(postCode) =>
        queryClient.query(trpc.source.addressByPostCode.queryOptions({ postCode }))
      }
      isNumberFree={(number) =>
        // A failed check lets the save through: the API refuses a taken number anyway.
        queryClient
          .query(
            trpc.client.numberAvailable.queryOptions(
              { number, excludeClientId: clientId },
              { staleTime: 0 },
            ),
          )
          .catch(() => true)
      }
      cancelHref={href(routes.client.list)}
      submitLabel="保存"
      pendingLabel="保存中…"
      pending={update.isPending}
      onSubmit={(input) => {
        update.mutate({ clientId, ...input });
      }}
    />
  );
};
