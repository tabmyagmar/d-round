"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Skeleton } from "@repo/ui/components/skeleton";

import { href, routes } from "@/config/routes";
import { StaffContactCard } from "@/features/staff/components/detail/staff-contact-card";
import { StaffDetailToolbar } from "@/features/staff/components/detail/staff-detail-toolbar";
import { StaffFamilyTable } from "@/features/staff/components/detail/staff-family-table";
import { StaffInfoCard } from "@/features/staff/components/detail/staff-info-card";
import { StaffJobHistoryTable } from "@/features/staff/components/detail/staff-job-history-table";
import { StaffMemosCard } from "@/features/staff/components/detail/staff-memos-card";
import { StaffStatusBadge } from "@/features/staff/components/staff-status-badge";
import { staffNameOf, staffReadingOf } from "@/features/staff/utils/staff-labels";
import { useTRPC } from "@/lib/trpc/react";

// Loaded when an action is chosen, not with the page.
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

type OpenDialog = "status" | "delete" | null;

/**
 * スタッフ情報詳細 (read-only, as the legacy StaffContainer): スタッフ情報 on the left;
 * 住所・連絡先情報, 在籍情報, 家族情報 and メモ on the right. The legacy 履歴書 card comes with the
 * file-upload ticket. After スタッフ削除 the page goes back to the list.
 */
export const StaffDetailContainer = ({ staffId }: { staffId: string }) => {
  const trpc = useTRPC();
  const router = useRouter();
  const staff = useQuery(trpc.staff.byId.queryOptions({ staffId }));
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const closeDialog = (open: boolean) => {
    if (!open) {
      setDialog(null);
    }
  };

  if (staff.isPending) {
    return <Skeleton className="h-64 w-full" />;
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
    <>
      {/* The header holds the page's h1 (the route title); the staff shown here is an h2. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate font-heading text-xl font-semibold">{staffNameOf(detail)}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate">{staffReadingOf(detail)}</span>
            <StaffStatusBadge status={detail.status} />
          </div>
        </div>
        <StaffDetailToolbar
          staff={detail}
          onChangeStatus={() => {
            setDialog("status");
          }}
          onDelete={() => {
            setDialog("delete");
          }}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <StaffInfoCard staff={detail} />
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
          <StaffContactCard staff={detail} />
          <StaffJobHistoryTable staff={detail} />
          <StaffFamilyTable familyMembers={detail.familyMembers} />
          <StaffMemosCard memos={detail.memos} />
        </div>
      </div>

      {dialog === "status" ? <StaffStatusDialog staff={detail} onOpenChange={closeDialog} /> : null}
      {dialog === "delete" ? (
        <StaffDeleteDialog
          ids={[detail.id]}
          onOpenChange={closeDialog}
          onDeleted={() => {
            router.push(href(routes.staff.list));
          }}
        />
      ) : null}
    </>
  );
};
