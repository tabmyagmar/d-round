import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { CsvMenu } from "@/features/csv/containers/csv-menu";
import { UsersContainer } from "@/features/users/containers/users-container";

const UserListPage = () => (
  <PageGuard route={routes.user.list}>
    <UsersContainer csvMenu={<CsvMenu entity="user" />} />
  </PageGuard>
);

export default UserListPage;
