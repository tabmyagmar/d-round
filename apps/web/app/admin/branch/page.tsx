import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { BranchesContainer } from "@/features/branches/containers/branches-container";

const BranchListPage = () => (
  <PageGuard route={routes.branch.list}>
    <BranchesContainer />
  </PageGuard>
);

export default BranchListPage;
