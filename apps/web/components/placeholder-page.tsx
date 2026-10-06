import { Construction } from "lucide-react";

import { EmptyState } from "@repo/ui/components/composed/empty-state";

import type { AppRoute } from "@/config/routes";

/** The body of a page that has no screen yet: a 準備中 notice naming the page. */
export const PlaceholderPage = ({ route }: { route: AppRoute }) => (
  <EmptyState
    icon={<Construction />}
    title="準備中"
    description={`「${route.title}」は現在開発中です。`}
  />
);
