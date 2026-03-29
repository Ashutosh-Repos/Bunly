"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { UploadProvider } from "@/components/providers/upload-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip"


export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <TRPCProvider>
        <UploadProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </UploadProvider>
      </TRPCProvider>
      <Toaster position="top-right" richColors closeButton />
    </ThemeProvider>
  );
}
