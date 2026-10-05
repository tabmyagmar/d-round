import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const SettingsHelpPage = () => (
  <PageGuard route={routes.settings.help}>
    <PlaceholderPage route={routes.settings.help} />
  </PageGuard>
);

export default SettingsHelpPage;
