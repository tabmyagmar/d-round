import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { UsersTable } from "@/features/users/users-table";

const UsersPage = () => (
  <PageGuard route={routes.user.list}>
    <UsersTable />
  </PageGuard>
);

export default UsersPage;
