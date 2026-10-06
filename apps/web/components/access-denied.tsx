import { ShieldX } from "lucide-react";
import Link from "next/link";

import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/composed/empty-state";

import { href, LANDING_ROUTE } from "@/config/routes";

/** The in-place 403 `PageGuard` renders inside the shell, with a way back to the landing page. */
export const AccessDenied = () => (
  <EmptyState
    icon={<ShieldX />}
    title="アクセス権限がありません"
    description="このページを表示する権限がありません。必要な場合は管理者にお問い合わせください。"
    action={
      <Button render={<Link href={href(LANDING_ROUTE)} />} nativeButton={false}>
        {`${LANDING_ROUTE.title}へ戻る`}
      </Button>
    }
  />
);
