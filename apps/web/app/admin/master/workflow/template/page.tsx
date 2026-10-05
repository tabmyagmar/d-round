import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const WorkflowTemplateListPage = () => (
  <PageGuard route={routes.workflowTemplate.list}>
    <PlaceholderPage route={routes.workflowTemplate.list} />
  </PageGuard>
);

export default WorkflowTemplateListPage;
