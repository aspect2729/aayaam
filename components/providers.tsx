"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { BusinessProvider } from "@/lib/business-context";
import { SessionProvider } from "@/lib/session-context";
import { AskBrainProvider } from "@/lib/ask-brain";
import { ActiveConfigProvider } from "@/lib/workspace/active";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <SessionProvider>
      <BusinessProvider>
        <ActiveConfigProvider>
        <AskBrainProvider>
          {children}
          <Toaster />
        </AskBrainProvider>
        </ActiveConfigProvider>
      </BusinessProvider>
      </SessionProvider>
    </TooltipProvider>
  );
}
