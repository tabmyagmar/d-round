import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const WorkflowTemplateUpdatePage = () => (
  <PageGuard route={routes.workflowTemplate.update}>
    <PlaceholderPage route={routes.workflowTemplate.update} />
  </PageGuard>
);

export default WorkflowTemplateUpdatePage;
