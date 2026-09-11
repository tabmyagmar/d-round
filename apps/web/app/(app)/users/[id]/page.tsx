import { UserEditor } from "@/features/users/user-editor";

const UserDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return <UserEditor userId={id} />;
};

export default UserDetailPage;
