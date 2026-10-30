"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrainMark } from "@/components/shared/brain-mark";
import { StatusChip } from "@/components/shared/status-chip";
import { toast } from "@/components/ui/use-toast";
import type { Insight } from "@/lib/types";

export function InsightCard({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"open" | "approved" | "dismissed">("open");

  if (state === "dismissed") return null;

  return (
    <Card className="p-6 transition-shadow duration-200 hover:shadow-cardHover">
      <div className="flex items-start justify-between gap-3">
        <BrainMark />
        {state === "approved" ? <StatusChip tone="mint">Done</StatusChip> : <StatusChip tone="sand">Pending</StatusChip>}
      </div>
      <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.02em]">{insight.title}</h3>
      <p className="mt-4 text-[13px] font-medium text-secondary">Investigation</p>
      <ul className="mt-2 space-y-1.5 text-sm text-ink">
        {insight.investigation.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] font-medium text-secondary">Proposed actions</p>
      <ul className="mt-2 space-y-1.5 text-sm text-ink">
        {insight.actions.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-light" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {state === "open" ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setOpen(true)}>Review & approve</Button>
          <Button
            variant="outline"
            onClick={() => {
              setState("dismissed");
              toast({ title: "Insight dismissed", description: "It will stay out of this view." });
            }}
          >
            Dismiss
          </Button>
        </div>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve these actions?</DialogTitle>
            <DialogDescription>
              Nothing is sent. This only marks the plan as approved in the prototype.
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-4 space-y-2 text-sm">
            {insight.actions.map((item) => (
              <li key={item} className="rounded-inner border border-line bg-accent-tint/40 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setState("approved");
                setOpen(false);
                toast({ title: "Actions approved", description: "Status updated to Done." });
              }}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
