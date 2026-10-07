import { DEFAULT_ROLE } from "@repo/validation";

import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { UserUpdateContainer } from "@/features/users/containers/user-update-container";
import { getCurrentUser } from "@/lib/auth/server";

const UserUpdatePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  // The guard reads the same cached user; the caller decides which account types are offered and
  // whether permissions may be edited (never one's own).
  const user = await getCurrentUser();
  return (
    <PageGuard route={routes.user.update}>
      <UserUpdateContainer
        userId={id}
        caller={{ id: user?.id ?? "", role: user?.role ?? DEFAULT_ROLE }}
      />
    </PageGuard>
  );
};

export default UserUpdatePage;
