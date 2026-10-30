"use client";

import { useState } from "react";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { StatusChip } from "@/components/shared/status-chip";
import { toneClasses } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { integrationCatalog } from "@/lib/mock-data";
import { useBusiness } from "@/lib/business-context";
import { record } from "@/lib/record";
import { cn } from "@/lib/utils";

export default function IntegrationsPage() {
  const { business } = useBusiness();
  const [connected, setConnected] = useState<string[]>(business.connectedIntegrations);

  return (
    <div className="space-y-4">
      <IllustrativeNote />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {integrationCatalog.map((item) => {
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
                ) : isOn ? (
                  <StatusChip tone="sand">Saved, not connected</StatusChip>
                ) : (
                  <StatusChip tone="blue">Not connected</StatusChip>
                )}
                {item.special === "later" ? (
                  <Button size="sm" variant="outline" disabled>
                    Coming later
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
