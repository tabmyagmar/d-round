import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/composed/empty-state";

import { href, LANDING_ROUTE } from "@/config/routes";

/** 404 inside the shell: `notFound()` in an /admin page and unknown URLs (`[...slug]`). */
const AdminNotFound = () => (
  <EmptyState
    icon={<FileQuestion />}
    title="ページが見つかりません"
    description="お探しのページは存在しないか、移動した可能性があります。"
    action={
      <Button render={<Link href={href(LANDING_ROUTE)} />} nativeButton={false}>
        {`${LANDING_ROUTE.title}へ戻る`}
      </Button>
    }
  />
);

export default AdminNotFound;
