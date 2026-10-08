import { PageGuard } from "@/components/page-guard";
import { routes } from "@/config/routes";
import { ClientBranchesContainer } from "@/features/branches/containers/client-branches-container";
import { ClientDetailContainer } from "@/features/clients/containers/client-detail-container";

const ClientDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <PageGuard route={routes.client.detail}>
      <ClientDetailContainer clientId={id} branches={<ClientBranchesContainer clientId={id} />} />
    </PageGuard>
  );
};

export default ClientDetailPage;
