import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { AuditLogsContainer } from "@/features/audit-log/containers/audit-logs-container";

const AuditLogListPage = () => (
  <PageGuard route={routes.auditLog.list}>
    <AuditLogsContainer />
  </PageGuard>
);

export default AuditLogListPage;
