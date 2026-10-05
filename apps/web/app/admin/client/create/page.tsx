import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const ClientCreatePage = () => (
  <PageGuard route={routes.client.create}>
    <PlaceholderPage route={routes.client.create} />
  </PageGuard>
);

export default ClientCreatePage;
