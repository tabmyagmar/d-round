import { DEFAULT_ROLE } from "@repo/validation";

import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { UserCreateContainer } from "@/features/users/containers/user-create-container";
import { getCurrentUser } from "@/lib/auth/server";

const UserCreatePage = async () => {
  // The guard reads the same cached user; the role decides which account types are offered.
  const user = await getCurrentUser();
  return (
    <PageGuard route={routes.user.create}>
      <UserCreateContainer callerRole={user?.role ?? DEFAULT_ROLE} />
    </PageGuard>
  );
};

export default UserCreatePage;
