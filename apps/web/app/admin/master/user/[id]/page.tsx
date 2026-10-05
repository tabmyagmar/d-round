import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { UserEditor } from "@/features/users/user-editor";

const UserDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.user.detail}>
      <UserEditor userId={id} />
    </PageGuard>
  );
};

export default UserDetailPage;
