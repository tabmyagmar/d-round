import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const AuditLogListPage = () => (
  <PageGuard route={routes.auditLog.list}>
    <PlaceholderPage route={routes.auditLog.list} />
  </PageGuard>
);

export default AuditLogListPage;
