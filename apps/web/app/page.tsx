import Link from "next/link";

import { Button } from "@repo/ui/components/button";

import { HealthStatus } from "@/components/health-status";
import { getServerSession } from "@/lib/auth/server";

const HomePage = async () => {
  const session = await getServerSession();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">d-round</h1>
        <p className="text-sm text-muted-foreground">
          Form templates &amp; approval workflows. Press <kbd>d</kbd> to toggle dark mode.
        </p>
      </header>

      <div className="flex gap-2">
        {session ? (
          <Button render={<Link href="/dashboard" />}>Open dashboard</Button>
        ) : (
          <>
            <Button render={<Link href="/login" />}>Sign in</Button>
            <Button variant="outline" render={<Link href="/register" />}>
              Create account
            </Button>
          </>
        )}
      </div>

      <HealthStatus />
    </main>
  );
};

export default HomePage;
