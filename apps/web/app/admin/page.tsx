import Link from "next/link";

import { defineAbilityFor } from "@repo/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { PageHeader } from "@repo/ui/components/composed/page-header";

import { PageGuard } from "@/components/page-guard";
import { href, routes } from "@/config/routes";
import { RoleBadge } from "@/features/users/role-badge";
import { canAccessRoute } from "@/lib/auth/route-access";
import { getCurrentUser } from "@/lib/auth/server";
import type { CurrentUser } from "@/lib/auth/server";

const Dashboard = ({ user }: { user: CurrentUser }) => (
  <>
    <PageHeader title={`Hello, ${user.name}`} description={`Signed in as ${user.email}`} />

    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Your role</CardTitle>
          <CardDescription>Determines what you can see and change.</CardDescription>
        </CardHeader>
        <CardContent>
          <RoleBadge role={user.role} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
          <CardDescription>
            Auth and user management are here; add your first module next.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Link className="underline" href={href(routes.profile)}>
            Edit your profile
          </Link>
          {canAccessRoute(defineAbilityFor(user), routes.user.list) ? (
            <Link className="underline" href={href(routes.user.list)}>
              Browse users
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  </>
);

/** ホーム: greeting, role and the links this ability opens. */
const HomePage = async () => {
  const user = await getCurrentUser();
  return (
    // PageGuard sends an anonymous visitor to login, so the `null` branch never renders.
    <PageGuard route={routes.home}>{user ? <Dashboard user={user} /> : null}</PageGuard>
  );
};

export default HomePage;
