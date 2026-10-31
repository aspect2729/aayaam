"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Search, Settings } from "lucide-react";
import { isNavActive } from "@/components/shell/nav";
import { useWorkspaceNav } from "@/lib/use-workspace-nav";
import { navLabel } from "@/lib/business-types";
import { titleForPath } from "@/lib/page-title";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBusiness } from "@/lib/business-context";
import { useSession } from "@/lib/session-context";
import { buildSearchIndex } from "@/lib/search";
import { cn } from "@/lib/utils";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { business } = useBusiness();
  const session = useSession();
  const { pills } = useWorkspaceNav();
  const heading = navLabel(business.type, titleForPath(pathname));
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return buildSearchIndex(business)
      .filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [business, query]);

  return (
    <div className="sticky top-0 z-20 bg-[#F4F5F8]/90 pb-3 pt-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-card" aria-label="Sections">
          {pills.map((pill) => {
            const active = pill.label === "Dashboard" ? pathname === "/" : pill.label === "Leads" ? false : isNavActive(pathname, pill.href);
            return (
              <Link
                key={pill.label}
                href={pill.href}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-200",
                  active ? "bg-accent text-white shadow-[0_6px_14px_rgba(109,74,255,0.35)]" : "text-[#4B5163] hover:bg-[#F4F5F8]"
                )}
                aria-current={active ? "page" : undefined}
              >
                {pill.label}
              </Link>
            );
          })}
        </nav>
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#3C4254] shadow-card transition-transform duration-200 hover:scale-105"
              aria-label="Search leads, orders, customers"
            >
              <Search className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search leads, orders, customers…"
              aria-label="Search leads, orders, customers"
            />
            <div className="mt-2">
              {query.trim() && results.length === 0 ? <p className="px-1 py-2 text-sm text-secondary">No matches in this workspace.</p> : null}
              {results.map((result, index) => (
                <button
                  key={`${result.href}-${result.label}-${index}`}
                  className="flex w-full flex-col rounded-inner px-2 py-2 text-left hover:bg-accent-tint"
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                    router.push(result.href);
                  }}
                >
                  <span className="text-sm font-medium">{result.label}</span>
                  <span className="text-[12px] text-secondary">{result.meta}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-1.5 text-[#3C4254] shadow-card"
              aria-label="Account menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EDE7FF] text-sm font-semibold text-accent">
                {session.name.slice(0, 1)}
              </span>
              <span className="hidden pr-2 text-left sm:block">
                <span className="block text-[13px] font-semibold leading-4">{session.name}</span>
                <span className="block text-[11px] text-secondary">Demo</span>
              </span>
              <Settings className="mr-1 hidden h-4 w-4 sm:block" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => router.push("/settings/permissions")}>Settings</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/settings/system")}>System status</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/plans")}>Plans</DropdownMenuItem>
            {session.signedIn ? (
              <DropdownMenuItem
                onSelect={() => {
                  void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                    session.refresh();
                    router.push("/");
                  });
                }}
              >
                Sign out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => router.push("/login")}>Sign in</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {pathname !== "/" ? (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{heading}</h1>
            <p className="mt-1 text-[13px] text-secondary">
              Overview <span className="px-1 text-muted">›</span> {heading}
            </p>
          </div>
          <LayoutGrid className="hidden h-4 w-4 text-secondary sm:block" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}
