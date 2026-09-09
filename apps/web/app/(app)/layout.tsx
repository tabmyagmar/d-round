import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { getServerSession, toCurrentUser } from "@/lib/auth/server";

/** Everything under (app) needs a valid session — checked server-side on every request. */
const AppLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return <AppShell user={toCurrentUser(session)}>{children}</AppShell>;
};

export default AppLayout;
