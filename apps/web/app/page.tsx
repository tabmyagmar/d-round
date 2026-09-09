import { HealthStatus } from "@/components/health-status";

const HomePage = () => (
  <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6">
    <header className="flex flex-col gap-1">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">d-round</h1>
      <p className="text-sm text-muted-foreground">
        Form templates &amp; approval workflows — Phase 0 foundation. Press <kbd>d</kbd> to toggle
        dark mode.
      </p>
    </header>

    <HealthStatus />
  </main>
);

export default HomePage;
