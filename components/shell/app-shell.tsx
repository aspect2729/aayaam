"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AskBrainDrawer } from "@/components/shell/ask-brain-drawer";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { useBusiness } from "@/lib/business-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { businessId } = useBusiness();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname, businessId]);

  return (
    <div className="min-h-screen bg-[#F4F5F8] lg:flex">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col px-3 md:px-5">
        <Topbar />
        <div ref={scroller} className="smooth-scroll min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-8">
          <div key={`${pathname}-${businessId}`} className="page-enter">
            {children}
          </div>
        </div>
      </div>
      <MobileNav />
      <AskBrainDrawer />
    </div>
  );
}
