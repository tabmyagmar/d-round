import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { UserDetailContainer } from "@/features/users/containers/user-detail-container";

const UserDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.user.detail}>
      <UserDetailContainer userId={id} />
    </PageGuard>
  );
};

export default UserDetailPage;
