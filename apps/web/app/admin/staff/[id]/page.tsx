import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { StaffDetailContainer } from "@/features/staff/containers/staff-detail-container";

const StaffDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.staff.detail}>
      <StaffDetailContainer staffId={id} />
    </PageGuard>
  );
};

export default StaffDetailPage;
