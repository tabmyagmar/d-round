import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const UserUpdatePage = () => (
  <PageGuard route={routes.user.update}>
    <PlaceholderPage route={routes.user.update} />
  </PageGuard>
);

export default UserUpdatePage;
