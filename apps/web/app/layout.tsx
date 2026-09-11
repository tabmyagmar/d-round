import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";

import "@repo/ui/globals.css";
import { Toaster } from "@repo/ui/components/sonner";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

import { ThemeProvider } from "@/components/theme-provider";
import { TRPCReactProvider } from "@/lib/trpc/react";

const fontSans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "d-round",
  description: "Form templates and approval workflows",
};

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <html
    lang="ja"
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
