"use client";

import { ContentDialog } from "@repo/ui/components/composed/content-dialog";

import { BranchDetail } from "@/features/branches/components/detail/branch-detail";
import type { BranchDetail as BranchDetailRow } from "@/features/branches/types";

export type BranchDetailDialogProps = {
  branch: BranchDetailRow;
  onOpenChange: (open: boolean) => void;
};

/**
 * 就業先部署情報 in a dialog, as the legacy client detail opened a branch's row (the legacy
 * BranchDetailDialog): the detail page's cards, from the row already loaded.
 */
export const BranchDetailDialog = ({ branch, onOpenChange }: BranchDetailDialogProps) => (
  <ContentDialog
    open
    onOpenChange={onOpenChange}
    title="就業先部署情報"
    className="max-h-[95vh] overflow-y-auto sm:max-w-5xl"
  >
    <BranchDetail branch={branch} />
  </ContentDialog>
);
