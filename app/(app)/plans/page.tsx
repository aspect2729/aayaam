"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useBusiness } from "@/lib/business-context";
import { record } from "@/lib/record";

const plans = [
  { name: "Starter", detail: "One business, the modules for that business type, and manual follow-up." },
  { name: "Growth", detail: "Team roles, reminders, and the connectors that are switched on." },
  { name: "Partner", detail: "More than one business and a named setup for the pilot." },
];

export default function PlansPage() {
  const { business } = useBusiness();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => (
        <Card key={plan.name} className="flex flex-col p-6">
          <h2 className="text-[22px] font-semibold tracking-[-0.03em]">{plan.name}</h2>
          <p className="mt-2 flex-1 text-sm text-secondary">{plan.detail}</p>
          <Button
            className="mt-6 rounded-full"
            variant="secondary"
            onClick={() => {
              record(business.id, "plan.contact", plan.name);
              toast({ title: "Billing is not connected", description: `${plan.name} is listed for later. No payment was taken.` });
            }}
          >
            Contact us
          </Button>
        </Card>
      ))}
    </div>
  );
}
