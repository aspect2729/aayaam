"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { BusinessProvider } from "@/lib/business-context";
import { AskBrainProvider } from "@/lib/ask-brain";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <BusinessProvider>
        <AskBrainProvider>
          {children}
          <Toaster />
        </AskBrainProvider>
      </BusinessProvider>
    </TooltipProvider>
  );
}
