import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { ClientsContainer } from "@/features/clients/containers/clients-container";
import { CsvMenu } from "@/features/csv/containers/csv-menu";

const ClientListPage = () => (
  <PageGuard route={routes.client.list}>
    <ClientsContainer csvMenu={<CsvMenu entity="client" />} />
  </PageGuard>
);

export default ClientListPage;
