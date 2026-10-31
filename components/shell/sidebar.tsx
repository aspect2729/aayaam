"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Sparkles } from "lucide-react";
import { BusinessSwitcher } from "@/components/shell/business-switcher";
import { isNavActive } from "@/components/shell/nav";
import { useWorkspaceNav } from "@/lib/use-workspace-nav";
import { istLabel } from "@/lib/ist";
import { useSession } from "@/lib/session-context";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { home, tools } = useWorkspaceNav();
  const session = useSession();
  const [today, setToday] = useState("Asia/Kolkata");

  useEffect(() => {
    setToday(istLabel());
  }, []);

  return (
    <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col bg-white px-4 py-5 lg:flex">
      <div className="flex items-center gap-2.5 px-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_16px_rgba(109,74,255,0.35)]">
          <span className="h-3.5 w-3.5 rounded-full border-[2.5px] border-white" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-[-0.02em]">Aayaam</p>
          <p className="whitespace-nowrap text-[10.5px] text-secondary">Your Business Operating System</p>
        </div>
      </div>

      <div className="mt-7 px-1">
        <h2 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.03em]">
          Welcome
          <br />
          Back, {session.name}!
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-secondary">
          Demo workspace · {today}
        </p>
      </div>

      <div className="mt-4 px-1">
        <BusinessSwitcher compact />
      </div>

      <div className="smooth-scroll mt-6 flex-1 overflow-y-auto pr-1">
        <p className="px-2 text-[11px] font-medium tracking-[0.14em] text-muted">HOME</p>
        <nav className="mt-2 space-y-0.5" aria-label="Home">
          {home.map((item) => {
            const active =
              item.label === "Overview"
                ? pathname === "/"
                : item.label !== "Leads" && !item.href.includes("#") && isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={(event) => {
                  if (item.href !== "/brain" || pathname !== "/") return;
                  const target = document.getElementById("brain");
                  if (!target) return;
                  event.preventDefault();
                  target.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-full px-3 py-2 text-[14px] transition-all duration-200",
                  active
                    ? "bg-[#17171C] font-medium text-white shadow-[0_8px_18px_rgba(23,23,28,0.18)]"
                    : "text-[#3C4254] hover:bg-[#F4F5F8]"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {active ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : null}
              </Link>
            );
          })}
        </nav>

        <p className="mt-6 px-2 text-[11px] font-medium tracking-[0.14em] text-muted">TOOLS</p>
        <nav className="mt-2 space-y-0.5" aria-label="Tools">
          {tools.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-full px-3 py-2 text-[14px] transition-all duration-200",
                  active ? "bg-[#F3EEFF] font-medium text-accent" : "text-[#3C4254] hover:bg-[#F4F5F8]"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Link
        href="/plans"
        className="relative mt-3 block overflow-hidden rounded-[22px] bg-[#F3EEFF] p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
      >
        <span className="absolute -right-3 -top-4 h-16 w-16 rounded-full bg-[#E4D9FF]" aria-hidden />
        <Sparkles className="h-4 w-4 text-accent" aria-hidden />
        <p className="mt-3 text-[18px] font-semibold leading-tight tracking-[-0.02em]">Unlock full potential</p>
        <p className="mt-1 text-[12px] text-secondary">AI agents for your business.</p>
        <span className="mt-3 inline-flex items-center rounded-full bg-[#17171C] px-3 py-1.5 text-[12px] font-medium text-white">
          Upgrade Now →
        </span>
      </Link>
    </aside>
  );
}
