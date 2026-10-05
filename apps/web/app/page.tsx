import Link from "next/link";

import { Button } from "@repo/ui/components/button";
import { PageHeader } from "@repo/ui/components/composed/page-header";

import { HealthStatus } from "@/components/health-status";
import { href, routes } from "@/config/routes";
import { getServerSession } from "@/lib/auth/server";
import { brand } from "@/lib/brand";

const HomePage = async () => {
  const session = await getServerSession();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6">
      <PageHeader
        title={brand.name}
        description={
          <>
            {brand.description}. Press <kbd>d</kbd> to toggle dark mode.
          </>
        }
      />

      <div className="flex gap-2">
        {session ? (
          <Button render={<Link href={href(routes.home)} />} nativeButton={false}>
            Open dashboard
          </Button>
        ) : (
          <Button render={<Link href={href(routes.auth.login)} />} nativeButton={false}>
            Sign in
          </Button>
        )}
      </div>

      <HealthStatus />
    </main>
  );
};

export default HomePage;
