import { PageHeader } from "@repo/ui/components/composed/page-header";

import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { UsersTable } from "@/features/users/users-table";

const UsersPage = () => (
  <PageGuard route={routes.user.list}>
    <PageHeader
      title={routes.user.list.title}
      description="The users your permissions let you read; the API filters every row."
    />
    <UsersTable />
  </PageGuard>
);

export default UsersPage;
