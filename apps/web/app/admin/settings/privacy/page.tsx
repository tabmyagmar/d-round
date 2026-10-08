import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { CommentTemplatesContainer } from "@/features/comment-templates/containers/comment-templates-container";

const SettingsPrivacyPage = () => (
  <PageGuard route={routes.settings.privacy}>
    <CommentTemplatesContainer />
  </PageGuard>
);

export default SettingsPrivacyPage;
