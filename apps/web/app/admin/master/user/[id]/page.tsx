import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { UserStaffsContainer } from "@/features/staff/containers/user-staffs-container";
import { UserDetailContainer } from "@/features/users/containers/user-detail-container";

const UserDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.user.detail}>
      <UserDetailContainer userId={id} staffs={<UserStaffsContainer userId={id} />} />
    </PageGuard>
  );
};

export default UserDetailPage;
