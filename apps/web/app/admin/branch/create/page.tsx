import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const BranchCreatePage = () => (
  <PageGuard route={routes.branch.create}>
    <PlaceholderPage route={routes.branch.create} />
  </PageGuard>
);

export default BranchCreatePage;
