import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { ClientUpdateContainer } from "@/features/clients/containers/client-update-container";

const ClientUpdatePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.client.update}>
      <ClientUpdateContainer clientId={id} />
    </PageGuard>
  );
};

export default ClientUpdatePage;
