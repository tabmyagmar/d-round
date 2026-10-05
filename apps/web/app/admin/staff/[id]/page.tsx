import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const StaffDetailPage = () => (
  <PageGuard route={routes.staff.detail}>
    <PlaceholderPage route={routes.staff.detail} />
  </PageGuard>
);

export default StaffDetailPage;
