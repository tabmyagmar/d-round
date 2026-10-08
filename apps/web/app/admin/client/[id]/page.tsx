import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { ClientDetailContainer } from "@/features/clients/containers/client-detail-container";

const ClientDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.client.detail}>
      <ClientDetailContainer clientId={id} />
    </PageGuard>
  );
};

export default ClientDetailPage;
