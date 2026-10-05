import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const StaffUpdatePage = () => (
  <PageGuard route={routes.staff.update}>
    <PlaceholderPage route={routes.staff.update} />
  </PageGuard>
);

export default StaffUpdatePage;
