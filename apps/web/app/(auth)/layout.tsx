import Link from "next/link";
import type { ReactNode } from "react";

import { brand } from "@/lib/brand";

const AuthLayout = ({ children }: { children: ReactNode }) => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
    <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
      {brand.name}
    </Link>
    <div className="w-full max-w-sm">{children}</div>
  </main>
);

export default AuthLayout;
