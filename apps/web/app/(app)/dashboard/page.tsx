import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { RoleBadge } from "@/components/role-badge";
import { getServerSession, toCurrentUser } from "@/lib/auth/server";

const DashboardPage = async () => {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  const user = toCurrentUser(session);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Hello, {user.name}</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email}
          {user.department ? ` · ${user.department}` : ""}
        </p>
      </header>

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
            <CardDescription>Phase 1 ships user management; templates come next.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Link className="underline" href="/profile">
              Edit your profile
            </Link>
            {user.role === "member" ? null : (
              <Link className="underline" href="/users">
                Browse users
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default DashboardPage;
