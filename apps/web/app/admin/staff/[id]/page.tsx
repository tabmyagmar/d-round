import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { AuditHistoryButton } from "@/features/audit-log/containers/audit-history-button";
import { StaffDetailContainer } from "@/features/staff/containers/staff-detail-container";

const StaffDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.staff.detail}>
      <StaffDetailContainer
        staffId={id}
        history={<AuditHistoryButton entityType="Staff" entityId={id} />}
      />
    </PageGuard>
  );
};

export default StaffDetailPage;
