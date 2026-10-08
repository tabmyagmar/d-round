"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Skeleton } from "@repo/ui/components/skeleton";
import { PAGINATION_MAX_PER_PAGE } from "@repo/validation";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { href, routes } from "@/config/routes";
import { StaffForm } from "@/features/staff/components/form/staff-form";
import { staffValuesOf } from "@/features/staff/utils/staff-form-input";
import { useTRPC } from "@/lib/trpc/react";

/**
 * スタッフ情報編集: loads the staff, saves the whole form with `staff.update` (the lists are
 * replaced, the 担当者 changes recorded — ADR 0008), then opens the detail page, where the legacy
 * toast sends the user (the legacy itself opened the list).
 */
export const StaffUpdateContainer = ({ staffId }: { staffId: string }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const staff = useQuery(trpc.staff.byId.queryOptions({ staffId }));
  const hierarchy = useSourceHierarchy();
  const templates = useQuery(
    trpc.commentTemplate.list.queryOptions({ type: "STAFF", perPage: PAGINATION_MAX_PER_PAGE }),
  );
  const update = useMutation(
    trpc.staff.update.mutationOptions({
      onSuccess: async () => {
        toast.success("スタッフ情報を編集しました", {
          description: "スタッフ詳細画面よりご確認ください。",
        });
        await queryClient.invalidateQueries(trpc.staff.pathFilter());
        router.push(href(routes.staff.detail, { id: staffId }));
      },
    }),
  );

  if (staff.isPending) {
    return <Skeleton className="h-64 w-full max-w-4xl" />;
  }
  if (staff.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>スタッフ情報を読み込めませんでした</AlertTitle>
        <AlertDescription>{staff.error.message}</AlertDescription>
      </Alert>
    );
  }

  const detail = staff.data;
  return (
    <StaffForm
      // A refetch after saving resets the form to the stored values.
      key={detail.updatedAt.toISOString()}
      title="スタッフ情報編集"
      defaultValues={staffValuesOf(detail)}
      hierarchy={hierarchy}
      findChargers={(regionCodes) =>
        queryClient.query(trpc.user.chargerOptions.queryOptions({ regionCodes }))
      }
      storedChargers={detail.chargers
        .filter((charger) => charger.unassignedAt === null)
        .map((charger) => charger.user)}
      findAddress={(postCode) =>
        queryClient.query(trpc.source.addressByPostCode.queryOptions({ postCode }))
      }
      isEmployeeNumberFree={(employeeNumber) =>
        // A failed check lets the save through: the API refuses a taken number anyway.
        queryClient
          .query(
            trpc.staff.employeeNumberAvailable.queryOptions(
              { employeeNumber, excludeStaffId: staffId },
              { staleTime: 0 },
            ),
          )
          .catch(() => true)
      }
      templates={templates.data?.items ?? []}
      cancelHref={href(routes.staff.detail, { id: staffId })}
      submitLabel="保存"
      pendingLabel="保存中…"
      pending={update.isPending}
      errorMessage={update.isError ? update.error.message : undefined}
      onSubmit={(input) => {
        update.mutate({ staffId, ...input });
      }}
    />
  );
};
