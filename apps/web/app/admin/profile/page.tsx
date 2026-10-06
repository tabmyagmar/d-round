import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { ProfileEditor } from "@/features/users/profile-editor";

const ProfilePage = () => (
  <PageGuard route={routes.profile}>
    <ProfileEditor />
  </PageGuard>
);

export default ProfilePage;
