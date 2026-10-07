import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { UsersContainer } from "@/features/users/containers/users-container";

const UserListPage = () => (
  <PageGuard route={routes.user.list}>
    <UsersContainer />
  </PageGuard>
);

export default UserListPage;
