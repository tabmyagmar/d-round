import { ContentCard } from "@repo/ui/components/composed/content-card";
import { DescriptionList } from "@repo/ui/components/composed/description-list";

import type { StaffDetail } from "@/features/staff/types";
import { STAFF_MEMO_TYPE_LABELS } from "@/features/staff/utils/staff-labels";

/** メモ, as the legacy StaffMemos card: each memo under its type, メモはありません without any. */
export const StaffMemosCard = ({ memos }: { memos: StaffDetail["memos"] }) => (
  <ContentCard title="メモ">
    {memos.length > 0 ? (
      <DescriptionList
        items={memos.map((memo) => ({
          key: memo.id,
          label: STAFF_MEMO_TYPE_LABELS[memo.memoType],
          value: <span className="whitespace-pre-wrap">{memo.content}</span>,
        }))}
      />
    ) : (
      <p className="py-4 text-center text-sm text-muted-foreground">メモはありません</p>
    )}
  </ContentCard>
);
