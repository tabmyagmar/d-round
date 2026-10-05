import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const WorkflowDetailPage = () => (
  <PageGuard route={routes.workflow.detail}>
    <PlaceholderPage route={routes.workflow.detail} />
  </PageGuard>
);

export default WorkflowDetailPage;
