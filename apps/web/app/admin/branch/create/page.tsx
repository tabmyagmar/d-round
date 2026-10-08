import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { BranchCreateContainer } from "@/features/branches/containers/branch-create-container";

const BranchCreatePage = () => (
  <PageGuard route={routes.branch.create}>
    <BranchCreateContainer />
  </PageGuard>
);

export default BranchCreatePage;
