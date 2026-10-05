import { PageGuard } from "@/components/page-guard";
import { PlaceholderPage } from "@/components/placeholder-page";
import { routes } from "@/config/routes";

const ClientUpdatePage = () => (
  <PageGuard route={routes.client.update}>
    <PlaceholderPage route={routes.client.update} />
  </PageGuard>
);

export default ClientUpdatePage;
