"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { href, routes } from "@/config/routes";
import { ClientForm } from "@/features/clients/components/form/client-form";
import { emptyClientValues } from "@/features/clients/utils/client-form-input";
import { clientSaveErrorOf } from "@/features/clients/utils/client-labels";
import { useTRPC } from "@/lib/trpc/react";

/**
 * クライアント追加 (`client.create`), then back to the list with the legacy toast. The 担当者 on
 * offer are every active user, as the legacy form's chargerUsers without variables.
 */
export const ClientCreateContainer = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const hierarchy = useSourceHierarchy();
  const chargers = useQuery(trpc.user.chargerOptions.queryOptions({}));
  const [defaultValues] = useState(emptyClientValues);

  const create = useMutation(
    trpc.client.create.mutationOptions({
      onSuccess: async () => {
        toast.success("クライアント作成");
        await queryClient.invalidateQueries(trpc.client.pathFilter());
        router.push(href(routes.client.list));
      },
      onError: (error) => {
        toast.error(clientSaveErrorOf(error));
      },
    }),
  );

  return (
    <ClientForm
      title="クライアント情報登録"
      defaultValues={defaultValues}
      hierarchy={hierarchy}
      chargerOptions={chargers.data ?? []}
      chargersLoading={chargers.isPending}
      findAddress={(postCode) =>
        queryClient.query(trpc.source.addressByPostCode.queryOptions({ postCode }))
      }
      isNumberFree={(number) =>
        // A failed check lets the form through: the API refuses a taken number anyway.
        queryClient
          .query(trpc.client.numberAvailable.queryOptions({ number }, { staleTime: 0 }))
          .catch(() => true)
      }
      cancelHref={href(routes.client.list)}
      submitLabel="追加"
      pendingLabel="追加中…"
      pending={create.isPending}
      onSubmit={(input) => {
        create.mutate(input);
      }}
    />
  );
};
