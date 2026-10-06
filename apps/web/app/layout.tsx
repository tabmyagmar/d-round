import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";

import "@repo/ui/globals.css";
import { Toaster } from "@repo/ui/components/sonner";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

import { ThemeProvider } from "@/components/theme-provider";
import { brand } from "@/lib/brand";
import { TRPCReactProvider } from "@/lib/trpc/react";

// --font-inter heads the --font-sans stack in packages/ui globals.css (JP fallbacks after it).
const fontSans = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: brand.name,
  description: brand.description,
};

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <html
    lang={brand.htmlLang}
    suppressHydrationWarning
    className={cn("font-sans antialiased", fontSans.variable, fontMono.variable)}
  >
    <body>
      <ThemeProvider>
        <TooltipProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </TooltipProvider>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
