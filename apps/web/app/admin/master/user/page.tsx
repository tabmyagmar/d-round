import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { UsersPage } from "@/features/users/list/users-page";

const UserListPage = () => (
  <PageGuard route={routes.user.list}>
    <UsersPage />
  </PageGuard>
);

export default UserListPage;
