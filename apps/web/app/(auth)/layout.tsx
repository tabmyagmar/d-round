import Link from "next/link";
import type { ReactNode } from "react";

const AuthLayout = ({ children }: { children: ReactNode }) => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
    <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
      d-round
    </Link>
    <div className="w-full max-w-sm">{children}</div>
  </main>
);

export default AuthLayout;
