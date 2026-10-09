import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { BranchUpdateContainer } from "@/features/branches/containers/branch-update-container";

const BranchUpdatePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.branch.update}>
      <BranchUpdateContainer branchId={id} />
    </PageGuard>
  );
};

export default BranchUpdatePage;
