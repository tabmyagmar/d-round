import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { ProfileContainer } from "@/features/users/containers/profile-container";

const ProfilePage = () => (
  <PageGuard route={routes.profile}>
    <ProfileContainer />
  </PageGuard>
);

export default ProfilePage;
