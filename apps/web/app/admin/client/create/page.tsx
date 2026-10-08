import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { ClientCreateContainer } from "@/features/clients/containers/client-create-container";

const ClientCreatePage = () => (
  <PageGuard route={routes.client.create}>
    <ClientCreateContainer />
  </PageGuard>
);

export default ClientCreatePage;
