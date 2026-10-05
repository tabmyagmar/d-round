import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const UserCreatePage = () => (
  <PageGuard route={routes.user.create}>
    <PlaceholderPage route={routes.user.create} />
  </PageGuard>
);

export default UserCreatePage;
