"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { isNavActive } from "@/components/shell/nav";
import { useWorkspaceNav } from "@/lib/use-workspace-nav";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const { items } = useWorkspaceNav();
  const pathname = usePathname();
  const primary = [
    items.find((item) => item.href === "/") ?? items[0],
    items.find((item) => item.href === "/sales") ?? items.find((item) => item.href === "/commerce") ?? items[1],
    items.find((item) => item.href === "/customers") ?? items[2],
    items.find((item) => item.href === "/marketing") ?? items[3],
  ].filter((item, index, list) => item && list.findIndex((other) => other.href === item.href) === index);
  const [open, setOpen] = useState(false);
  const moreActive = items.slice(4).some((item) => isNavActive(pathname, item.href));

  return (
    <>
      <nav
        className="fixed bottom-3 left-3 right-3 z-40 grid grid-cols-5 rounded-card border border-line bg-white p-1 shadow-card lg:hidden"
        aria-label="Mobile"
      >
        {primary.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-inner px-1 py-2 text-[11px]",
                active ? "bg-accent-tint text-accent" : "text-secondary"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="truncate">{item.label === "Overview" ? "Home" : item.label}</span>
            </Link>
          );
        })}
        <button
          className={cn(
            "flex flex-col items-center gap-1 rounded-inner px-1 py-2 text-[11px]",
            moreActive ? "bg-accent-tint text-accent" : "text-secondary"
          )}
          onClick={() => setOpen(true)}
          aria-label="More sections"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
          More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="px-4 pb-6 pt-2">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 p-4">
            {items.slice(4).map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-inner px-3 py-3 text-sm",
                    active ? "bg-accent-tint text-accent" : "hover:bg-accent-tint"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
