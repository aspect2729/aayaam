"use client";

import { useState } from "react";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { StatusChip } from "@/components/shared/status-chip";
import { toneClasses } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { integrationForBusiness } from "@/lib/business-types";
import { integrationCatalog } from "@/lib/mock-data";
import { useBusiness } from "@/lib/business-context";
import { record } from "@/lib/record";
import { cn } from "@/lib/utils";

export default function IntegrationsPage() {
  const { business } = useBusiness();
  const [connected, setConnected] = useState<string[]>(business.connectedIntegrations);
  const [showAll, setShowAll] = useState(false);
  const visible = integrationCatalog.filter((item) => integrationForBusiness(business.type, item.commerceOnly, showAll));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IllustrativeNote />
        <button
          className="h-9 rounded-full bg-white px-3 text-[13px] font-medium shadow-card"
          onClick={() => setShowAll((value) => !value)}
          aria-pressed={showAll}
        >
          {showAll ? "Showing every integration" : "Show all integrations"}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => {
          const isOn = connected.includes(item.id);
          return (
            <Card key={item.id} className="flex flex-col p-5 transition-shadow hover:shadow-cardHover">
              <div className="flex items-start gap-3">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-inner border text-sm font-semibold", toneClasses[item.tone])}>
                  {item.mark}
                </span>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold tracking-[-0.02em]">{item.name}</h2>
                  <p className="mt-1 text-sm text-secondary">{item.description}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                {item.special === "approval" ? (
                  <StatusChip tone="sand">API approval required</StatusChip>
                ) : item.special === "later" ? (
                  <span className="text-[12px] text-muted">Coming later</span>
                ) : item.special === "awaiting" ? (
                  <StatusChip tone="sand">Awaiting setup</StatusChip>
                ) : isOn ? (
                  <StatusChip tone="sand">Saved, not connected</StatusChip>
                ) : (
                  <StatusChip tone="blue">Not connected</StatusChip>
                )}
                {item.special === "later" || item.special === "awaiting" ? (
                  <Button size="sm" variant="outline" disabled>
                    {item.special === "later" ? "Coming later" : "Awaiting setup"}
                  </Button>
                ) : item.special === "approval" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      record(business.id, "integration.request", item.name);
                      toast({ title: "Request saved", description: "API approval is still required, so this is not connected." });
                    }}
                  >
                    Request access
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant={isOn ? "outline" : "default"}
                    onClick={() => {
                      setConnected((current) =>
                        current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]
                      );
                      record(business.id, isOn ? "integration.dismiss" : "integration.request", item.name);
                      toast({
                        title: isOn ? "Removed" : "Setup saved",
                        description: `${item.name} is not connected. Credentials are still missing.`,
                      });
                    }}
                  >
                    {isOn ? "Remove" : "Save setup"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
