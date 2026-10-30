"use client";

import { Fragment, useState } from "react";
import { agentLabel, agentTone } from "@/components/shared/tones";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { useBusiness } from "@/lib/business-context";
import { record } from "@/lib/record";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const { business } = useBusiness();
  const [openId, setOpenId] = useState<string | null>(business.agents[0]?.id ?? null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  const waiting = business.approvals.filter((item) => !approved[item.id]);

  const approve = (id: string, title: string) => {
    setApproved((current) => ({ ...current, [id]: true }));
    record(business.id, "approval.record", title);
    toast({ title: "Approved in Aayaam", description: `${title}. No outside system was changed.` });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader title="Runs" description="What each agent looked at, and what it did." />
          <IllustrativeNote />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[12px] text-secondary">
                <th className="px-2 py-2 font-medium">Agent</th>
                <th className="px-2 py-2 font-medium">Task</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {business.agents.map((run) => {
                const expanded = openId === run.id;
                return (
                  <Fragment key={run.id}>
                    <tr className="border-t border-line hover:bg-accent-tint/50">
                      <td className="px-2 py-3 font-medium">{run.agent}</td>
                      <td className="px-2 py-3">{run.task}</td>
                      <td className="px-2 py-3">
                        <StatusChip tone={agentTone[run.status]}>{agentLabel[run.status]}</StatusChip>
                      </td>
                      <td className="px-2 py-3">
                        <button
                          className="text-accent"
                          aria-expanded={expanded}
                          onClick={() => setOpenId(expanded ? null : run.id)}
                        >
                          {run.time}
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-line bg-[#F8FAFF]">
                        <td colSpan={4} className="px-3 py-3">
                          <dl className="grid gap-2 md:grid-cols-2">
                            <Detail label="Input" value={run.input} />
                            <Detail label="Reasoning summary" value={run.reasoning} />
                            <Detail label="Action" value={run.action} />
                            <Detail label="Result" value={run.result} />
                          </dl>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="h-fit p-5 xl:sticky xl:top-6">
        <SectionHeader title={`${waiting.length} follow-ups awaiting approval`} />
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            disabled={waiting.length === 0}
            onClick={() => {
              const next: Record<string, boolean> = {};
              business.approvals.forEach((item) => {
                next[item.id] = true;
              });
              setApproved(next);
              record(business.id, "approval.record", "all pending items");
              toast({ title: "Approved in Aayaam", description: "The queue is clear here. No outside system was changed." });
            }}
          >
            Approve all
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpenId(business.agents[0]?.id ?? null)}>
            Review
          </Button>
        </div>
        <ul className="mt-4 max-h-[480px] space-y-2 overflow-y-auto">
          {business.approvals.map((item) => (
            <li key={item.id} className={cn("rounded-inner border border-line px-3 py-2", approved[item.id] && "opacity-60")}>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-[12px] text-secondary">{item.meta}</p>
              <div className="mt-2">
                {approved[item.id] ? (
                  <StatusChip tone="mint">Done</StatusChip>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => approve(item.id, item.title)}>
                    Approve
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-secondary">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
