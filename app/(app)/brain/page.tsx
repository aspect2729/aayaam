"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { useAskBrain } from "@/lib/ask-brain";
import { useBusiness } from "@/lib/business-context";
import { record } from "@/lib/record";

export default function BrainPage() {
  const { business } = useBusiness();
  const { openWith } = useAskBrain();
  const [openId, setOpenId] = useState(business.insights[0]?.id ?? "");
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenId(business.insights[0]?.id ?? "");
    setApproved({});
  }, [business.id, business.insights]);
  const selected = business.insights.find((item) => item.id === openId) ?? business.insights[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader title="Insights" description="Each note stays inside this business. The figures on this page are demo data." />
        <IllustrativeNote />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5">
          <ul className="space-y-2">
            {business.insights.map((insight) => (
              <li key={insight.id}>
                <button
                  className="w-full rounded-inner px-3 py-3 text-left hover:bg-[#F4F5F8]"
                  onClick={() => setOpenId(insight.id)}
                >
                  <span className="block text-[15px] font-medium">{insight.title}</span>
                  <span className="text-[12px] text-secondary">{insight.investigation[0]}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected ? (
            <div className="mt-4 rounded-[20px] bg-[#F6F7FB] p-4">
              <p className="text-[13px] font-semibold">Source notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-secondary">
                {selected.investigation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-3 text-[13px] font-semibold">Suggested next steps</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-secondary">
                {selected.actions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <Button className="mt-4 rounded-full" onClick={() => openWith(selected.title)}>
                Ask Business Brain
              </Button>
            </div>
          ) : null}
        </Card>
        <Card className="p-5">
          <SectionHeader title="Approval queue" description="Approving here records the decision. It does not send a message or change a payment." />
          <ul className="mt-4 space-y-2">
            {business.approvals.slice(0, 6).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-inner border border-line px-3 py-2">
                <span className="text-sm">{item.title}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={approved[item.id]}
                  onClick={() => {
                    setApproved((current) => ({ ...current, [item.id]: true }));
                    record(business.id, "approval.record", item.title);
                    toast({ title: "Recorded in Aayaam", description: "No outside system was changed." });
                  }}
                >
                  {approved[item.id] ? "Recorded" : "Approve"}
                </Button>
              </li>
            ))}
          </ul>
          <Link href="/agents" className="mt-4 inline-flex text-sm font-medium text-accent">
            Open agent activity
          </Link>
        </Card>
      </div>
    </div>
  );
}
