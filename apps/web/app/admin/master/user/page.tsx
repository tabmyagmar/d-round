import { PageHeader } from "@repo/ui/components/composed/page-header";

import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { UsersTable } from "@/features/users/users-table";

const UsersPage = () => (
  <PageGuard route={routes.user.list}>
    <PageHeader
      title={routes.user.list.title}
      description="You only see the users your role allows; admins see everyone."
    />
    <UsersTable />
  </PageGuard>
);

export default UsersPage;
