import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const BranchUpdatePage = () => (
  <PageGuard route={routes.branch.update}>
    <PlaceholderPage route={routes.branch.update} />
  </PageGuard>
);

export default BranchUpdatePage;
