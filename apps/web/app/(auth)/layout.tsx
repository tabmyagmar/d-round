import Image from "next/image";
import type { ReactNode } from "react";

import { brand } from "@/lib/brand";

/** The brand background behind the page's `AuthCard`, centred (legacy d-round-web auth layout). */
const AuthLayout = ({ children }: { children: ReactNode }) => (
  <main className="relative isolate flex min-h-svh items-center justify-center p-6">
    <Image
      src={brand.authBackground}
      alt=""
      fill
      priority
      sizes="100vw"
      className="-z-10 object-cover"
    />
    {children}
  </main>
);

export default AuthLayout;
