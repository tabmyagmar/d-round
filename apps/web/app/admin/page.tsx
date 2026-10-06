import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { HomeDashboard } from "@/features/home/home-dashboard";
import { getCurrentUser } from "@/lib/auth/server";

const HomePage = async () => {
  const user = await getCurrentUser();
  return (
    // PageGuard sends an anonymous visitor to login, so the `null` branch never renders.
    <PageGuard route={routes.home}>{user ? <HomeDashboard user={user} /> : null}</PageGuard>
  );
};

export default HomePage;
