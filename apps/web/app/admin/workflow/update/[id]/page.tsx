import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const WorkflowUpdatePage = () => (
  <PageGuard route={routes.workflow.update}>
    <PlaceholderPage route={routes.workflow.update} />
  </PageGuard>
);

export default WorkflowUpdatePage;
