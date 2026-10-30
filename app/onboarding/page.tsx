"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { businessTypeCards, onboardingTools } from "@/lib/mock-data";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toneClasses } from "@/components/shared/status-chip";
import { toast } from "@/components/ui/use-toast";
import type { BusinessId } from "@/lib/types";

const steps = ["Business", "Tools", "Ready"];

export default function OnboardingPage() {
  const { setBusinessId } = useBusiness();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  const choose = (id: string, businessId: BusinessId, title: string) => {
    setSelected(id);
    setBusinessId(businessId);
    if (id === "other") {
      toast({ title: "Sample workspace", description: "Other services open the Shakti Fitness preview." });
    } else {
      toast({ title: "Workspace selected", description: title });
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-4xl rounded-card border border-line bg-white p-6 shadow-card md:p-10">
        <p className="text-center text-[12px] text-secondary">Aayaam</p>
        <h1 className="mt-4 text-center text-[36px] font-semibold leading-tight tracking-[-0.02em] md:text-[48px]">
          <span className="text-gradient">Grow</span> <span className="text-ink">your</span>{" "}
          <span className="text-gradient">business</span>
        </h1>
        <p className="mt-3 text-center text-[15px] text-secondary">One platform. One business brain.</p>

        <ol className="mx-auto mt-6 flex max-w-md items-center justify-center gap-2">
          {steps.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold",
                  index === step ? "bg-accent text-white" : index < step ? "bg-chip-mint text-chip-mint-ink" : "bg-accent-tint text-secondary"
                )}
              >
                {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={cn("text-[13px]", index === step ? "font-medium text-ink" : "text-secondary")}>{label}</span>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {businessTypeCards.map((card) => (
              <button
                key={card.id}
                onClick={() => choose(card.id, card.businessId, card.title)}
                className={cn(
                  "rounded-card border p-6 text-left transition-shadow hover:shadow-card",
                  selected === card.id ? "border-accent bg-accent-tint" : "border-line bg-white"
                )}
              >
                <p className="text-[20px] font-semibold tracking-[-0.02em]">{card.title}</p>
                <p className="mt-2 text-sm text-secondary">{card.detail}</p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {onboardingTools.map((tool) => {
              const on = !!connected[tool.id];
              return (
                <div key={tool.id} className="flex items-center gap-3 rounded-card border border-line p-4">
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-inner border text-sm font-semibold", toneClasses[tool.tone])}>
                    {tool.mark}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{tool.name}</p>
                    <p className="text-[12px] text-secondary">{tool.detail}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={on ? "outline" : "default"}
                    onClick={() => setConnected((current) => ({ ...current, [tool.id]: !current[tool.id] }))}
                  >
                    {on ? "Connected" : "Connect"}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-10 text-center">
            <p className="text-[28px] font-semibold tracking-[-0.02em]">Your Business Brain is ready.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-secondary">
              The workspace is a preview with sample numbers. You can switch businesses from the sidebar at any time.
            </p>
            <Button className="mt-6" asChild>
              <Link href="/">Enter workspace</Link>
            </Button>
          </div>
        ) : null}

        {step < 2 ? (
          <div className="mt-8 flex justify-between">
            <Button variant="ghost" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>
              Back
            </Button>
            <Button onClick={() => setStep((value) => value + 1)} disabled={step === 0 && !selected}>
              Continue
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
