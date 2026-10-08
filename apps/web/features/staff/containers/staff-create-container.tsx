"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PAGINATION_MAX_PER_PAGE } from "@repo/validation";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { href, routes } from "@/config/routes";
import { StaffForm } from "@/features/staff/components/form/staff-form";
import { emptyStaffValues } from "@/features/staff/utils/staff-form-input";
import { useTRPC } from "@/lib/trpc/react";

/**
 * スタッフ追加 (`staff.create`), then back to the list with the legacy toast. The form asks the
 * reference data, the 担当者 for its regions, the address of a post code and whether the スタッフ番号
 * is free through the lookups passed here.
 */
export const StaffCreateContainer = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const hierarchy = useSourceHierarchy();
  const templates = useQuery(
    trpc.commentTemplate.list.queryOptions({ type: "STAFF", perPage: PAGINATION_MAX_PER_PAGE }),
  );
  // Today's first 在籍情報 row, read once.
  const [defaultValues] = useState(emptyStaffValues);

  const create = useMutation(
    trpc.staff.create.mutationOptions({
      onSuccess: async () => {
        toast.success("スタッフが追加されました。", {
          description: "スタッフ一覧よりご確認ください。",
        });
        await queryClient.invalidateQueries(trpc.staff.pathFilter());
        router.push(href(routes.staff.list));
      },
    }),
  );

  return (
    <StaffForm
      title="スタッフ情報登録"
      defaultValues={defaultValues}
      hierarchy={hierarchy}
      findChargers={(regionCodes) =>
        queryClient.query(trpc.user.chargerOptions.queryOptions({ regionCodes }))
      }
      findAddress={(postCode) =>
        queryClient.query(trpc.source.addressByPostCode.queryOptions({ postCode }))
      }
      isEmployeeNumberFree={(employeeNumber) =>
        // A failed check lets the form through: the API refuses a taken number anyway.
        queryClient
          .query(
            trpc.staff.employeeNumberAvailable.queryOptions({ employeeNumber }, { staleTime: 0 }),
          )
          .catch(() => true)
      }
      templates={templates.data?.items ?? []}
      cancelHref={href(routes.staff.list)}
      submitLabel="追加"
      pendingLabel="追加中…"
      pending={create.isPending}
      errorMessage={create.isError ? create.error.message : undefined}
      onSubmit={(input) => {
        create.mutate(input);
      }}
    />
  );
};
