import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const StaffListPage = () => (
  <PageGuard route={routes.staff.list}>
    <PlaceholderPage route={routes.staff.list} />
  </PageGuard>
);

export default StaffListPage;
