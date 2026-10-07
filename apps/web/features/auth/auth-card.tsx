import Image from "next/image";
import type { ReactNode } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";

import { brand } from "@/lib/brand";

/**
 * The card of every auth page, centred on the background of `app/(auth)/layout.tsx` (the legacy
 * `AuthWrapper`): the logo, a large title and an optional description above the page's own
 * `CardContent` / `CardFooter`. Footers lose the grey band of the default card, centre their
 * links and keep only a top gap, so the card reads as one white panel; the card keeps its bottom
 * padding.
 */
export const AuthCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) => (
  <Card className="w-full max-w-[460px] gap-3 shadow-lg shadow-primary/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-(--card-spacing) **:data-[slot=card-footer]:justify-center **:data-[slot=card-footer]:border-t-0 **:data-[slot=card-footer]:bg-transparent **:data-[slot=card-footer]:px-(--card-spacing) **:data-[slot=card-footer]:pt-6 **:data-[slot=card-footer]:pb-0 sm:gap-6 sm:[--card-spacing:--spacing(12)]">
    <CardHeader className="justify-items-center gap-2 text-center">
      <Image
        src={brand.logo.src}
        width={brand.logo.width}
        height={brand.logo.height}
        alt={brand.name}
        priority
        className="mb-2 h-15 w-auto dark:brightness-0 dark:invert"
      />
      <CardTitle className="text-3xl font-bold text-primary sm:text-4xl">{title}</CardTitle>
      {description ? (
        <CardDescription className="font-semibold">{description}</CardDescription>
      ) : null}
    </CardHeader>
    {children}
  </Card>
);
