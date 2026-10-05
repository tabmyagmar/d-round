import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const BranchDetailPage = () => (
  <PageGuard route={routes.branch.detail}>
    <PlaceholderPage route={routes.branch.detail} />
  </PageGuard>
);

export default BranchDetailPage;
