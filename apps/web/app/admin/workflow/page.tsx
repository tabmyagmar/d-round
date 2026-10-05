import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const WorkflowListPage = () => (
  <PageGuard route={routes.workflow.list}>
    <PlaceholderPage route={routes.workflow.list} />
  </PageGuard>
);

export default WorkflowListPage;
