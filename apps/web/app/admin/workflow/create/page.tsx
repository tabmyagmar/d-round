import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const WorkflowCreatePage = () => (
  <PageGuard route={routes.workflow.create}>
    <PlaceholderPage route={routes.workflow.create} />
  </PageGuard>
);

export default WorkflowCreatePage;
