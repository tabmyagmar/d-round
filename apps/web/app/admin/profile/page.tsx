import { PageHeader } from "@repo/ui/components/composed/page-header";

import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { ProfileEditor } from "@/features/users/profile-editor";

const ProfilePage = () => (
  <PageGuard route={routes.profile}>
    <PageHeader title={routes.profile.title} description="The name shown to other users." />
    <ProfileEditor />
  </PageGuard>
);

export default ProfilePage;
