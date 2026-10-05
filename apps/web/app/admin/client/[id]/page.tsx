import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const ClientDetailPage = () => (
  <PageGuard route={routes.client.detail}>
    <PlaceholderPage route={routes.client.detail} />
  </PageGuard>
);

export default ClientDetailPage;
