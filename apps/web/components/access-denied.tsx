import { ShieldX } from "lucide-react";
import Link from "next/link";

import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/composed/empty-state";

import { href, routes } from "@/config/routes";

/** The in-place 403 that `PageGuard` renders inside the shell, with a way back to ホーム. */
export const AccessDenied = () => (
  <EmptyState
    icon={<ShieldX />}
    title="アクセス権限がありません"
    description="このページを表示する権限がありません。必要な場合は管理者にお問い合わせください。"
    action={
      <Button render={<Link href={href(routes.home)} />} nativeButton={false}>
        ホームへ戻る
      </Button>
    }
  />
);
