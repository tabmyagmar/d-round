import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { StaffCreateContainer } from "@/features/staff/containers/staff-create-container";

const StaffCreatePage = () => (
  <PageGuard route={routes.staff.create}>
    <StaffCreateContainer />
  </PageGuard>
);

export default StaffCreatePage;
