import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const ClientListPage = () => (
  <PageGuard route={routes.client.list}>
    <PlaceholderPage route={routes.client.list} />
  </PageGuard>
);

export default ClientListPage;
