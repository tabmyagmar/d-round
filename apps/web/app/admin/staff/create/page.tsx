import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const StaffCreatePage = () => (
  <PageGuard route={routes.staff.create}>
    <PlaceholderPage route={routes.staff.create} />
  </PageGuard>
);

export default StaffCreatePage;
