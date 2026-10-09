import { Building2 } from "lucide-react";

import { ContentCard } from "@repo/ui/components/composed/content-card";

// TODO(D_ROUND-TBD): 担当クライアント — list the clients this user is in charge of once the Client
// model exists (legacy UserClients), handed in by the page as the staff feature's
// UserStaffsContainer is. Until then the card only says so.
export const UserChargesPlaceholder = () => (
  <ContentCard
    title={
      <>
        <Building2 aria-hidden className="size-4" />
        担当クライアント
      </>
    }
  >
    <p className="text-sm text-muted-foreground">
      準備中です。クライアント管理の実装後に表示されます。
    </p>
  </ContentCard>
);
