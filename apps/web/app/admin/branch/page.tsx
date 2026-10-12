import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { BranchesContainer } from "@/features/branches/containers/branches-container";
import { CsvMenu } from "@/features/csv/containers/csv-menu";

const BranchListPage = () => (
  <PageGuard route={routes.branch.list}>
    <BranchesContainer csvMenu={<CsvMenu entity="branch" />} />
  </PageGuard>
);

export default BranchListPage;
