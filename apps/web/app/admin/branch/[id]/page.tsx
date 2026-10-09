import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { BranchDetailContainer } from "@/features/branches/containers/branch-detail-container";

const BranchDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.branch.detail}>
      <BranchDetailContainer branchId={id} />
    </PageGuard>
  );
};

export default BranchDetailPage;
