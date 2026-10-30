import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";
import type { Kpi } from "@/lib/types";

export function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <Card className="p-6 transition-shadow duration-200 hover:shadow-cardHover">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-secondary">{kpi.label}</p>
        {kpi.attention ? <StatusChip tone="rose">Needs attention</StatusChip> : null}
      </div>
      <p className="mt-3 text-[32px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{kpi.value}</p>
      {kpi.delta ? (
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-sm font-medium",
            kpi.direction === "down" ? "text-chip-rose-ink" : "text-chip-mint-ink"
          )}
        >
          {kpi.direction === "down" ? (
            <ArrowDownRight className="h-4 w-4" aria-hidden />
          ) : (
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          )}
          {kpi.delta}
        </p>
      ) : (
        <p className="mt-2 text-sm text-secondary">This month</p>
      )}
    </Card>
  );
}
