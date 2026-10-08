import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { HelpContainer } from "@/features/help/containers/help-container";

const SettingsHelpPage = () => (
  <PageGuard route={routes.settings.help}>
    <HelpContainer />
  </PageGuard>
);

export default SettingsHelpPage;
