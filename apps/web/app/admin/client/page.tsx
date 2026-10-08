import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { ClientsContainer } from "@/features/clients/containers/clients-container";

const ClientListPage = () => (
  <PageGuard route={routes.client.list}>
    <ClientsContainer />
  </PageGuard>
);

export default ClientListPage;
