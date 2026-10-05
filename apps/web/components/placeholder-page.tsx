import { Construction } from "lucide-react";

import { EmptyState } from "@repo/ui/components/composed/empty-state";
import { PageHeader } from "@repo/ui/components/composed/page-header";

import type { AppRoute } from "@/config/routes";

/** The body of a page that has no screen yet: its catalog title and a 準備中 notice. */
export const PlaceholderPage = ({ route }: { route: AppRoute }) => (
  <>
    <PageHeader title={route.title} />
    <EmptyState icon={<Construction />} title="準備中" description="この画面は現在開発中です。" />
  </>
);
