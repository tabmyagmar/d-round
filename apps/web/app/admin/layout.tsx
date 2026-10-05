import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { href, routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * Everything under /admin needs a session — checked server-side on every request; each page
 * then adds its own `PageGuard`. The sidebar stores its open state in the `sidebar_state` cookie.
 */
const AdminLayout = async ({ children }: { children: ReactNode }) => {
  const user = await getCurrentUser();
  if (!user) {
    redirect(href(routes.auth.login));
  }
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <AppShell user={user} defaultOpen={defaultOpen}>
      {children}
    </AppShell>
  );
};

export default AdminLayout;
