import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const WorkflowTemplateCreatePage = () => (
  <PageGuard route={routes.workflowTemplate.create}>
    <PlaceholderPage route={routes.workflowTemplate.create} />
  </PageGuard>
);

export default WorkflowTemplateCreatePage;
