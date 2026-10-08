import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { StaffsContainer } from "@/features/staff/containers/staffs-container";

const StaffListPage = () => (
  <PageGuard route={routes.staff.list}>
    <StaffsContainer />
  </PageGuard>
);

export default StaffListPage;
