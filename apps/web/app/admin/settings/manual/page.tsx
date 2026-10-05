import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const SettingsManualPage = () => (
  <PageGuard route={routes.settings.manual}>
    <PlaceholderPage route={routes.settings.manual} />
  </PageGuard>
);

export default SettingsManualPage;
