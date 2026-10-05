import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const SettingsPrivacyPage = () => (
  <PageGuard route={routes.settings.privacy}>
    <PlaceholderPage route={routes.settings.privacy} />
  </PageGuard>
);

export default SettingsPrivacyPage;
