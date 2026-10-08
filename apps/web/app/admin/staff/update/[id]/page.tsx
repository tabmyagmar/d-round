import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { StaffUpdateContainer } from "@/features/staff/containers/staff-update-container";

const StaffUpdatePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.staff.update}>
      <StaffUpdateContainer staffId={id} />
    </PageGuard>
  );
};

export default StaffUpdatePage;
