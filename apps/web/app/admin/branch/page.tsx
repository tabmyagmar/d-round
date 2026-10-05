import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const BranchListPage = () => (
  <PageGuard route={routes.branch.list}>
    <PlaceholderPage route={routes.branch.list} />
  </PageGuard>
);

export default BranchListPage;
