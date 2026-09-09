import { UserEditor } from "./user-editor";

const UserDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return <UserEditor userId={id} />;
};

export default UserDetailPage;
