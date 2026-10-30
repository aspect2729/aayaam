"use client";

import { Check } from "lucide-react";
import { useBusiness } from "@/lib/business-context";
import { toast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BusinessId } from "@/lib/types";

export function BusinessSwitcher({ compact = false }: { compact?: boolean }) {
  const { business, businesses, setBusinessId } = useBusiness();

  const choose = (id: BusinessId, name: string) => {
    setBusinessId(id);
    toast({ title: "Workspace switched", description: name });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center justify-between gap-2 rounded-inner border border-line bg-white px-3 py-2 text-left hover:bg-accent-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Switch business"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{business.name.split(",")[0]}</span>
          {!compact ? (
            <span className="block truncate text-[12px] text-secondary">
              {business.city} · {business.typeLabel}
            </span>
          ) : null}
        </span>
        <span className="text-[12px] text-secondary">Switch</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px]" align="start">
        <DropdownMenuLabel>Business workspace</DropdownMenuLabel>
        {businesses.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => choose(item.id, item.name)}>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{item.name}</span>
              <span className="block text-[12px] text-secondary">{item.typeLabel}</span>
            </span>
            {item.id === business.id ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
