import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { CsvMenu } from "@/features/csv/containers/csv-menu";
import { StaffsContainer } from "@/features/staff/containers/staffs-container";

const StaffListPage = () => (
  <PageGuard route={routes.staff.list}>
    <StaffsContainer csvMenu={<CsvMenu entity="staff" />} />
  </PageGuard>
);

export default StaffListPage;
