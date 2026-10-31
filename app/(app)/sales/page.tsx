"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Flag, Inbox } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BrainMark } from "@/components/shared/brain-mark";
import { EmptyState } from "@/components/shared/empty-state";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusChip } from "@/components/shared/status-chip";
import { chartTooltip, sourceTone } from "@/components/shared/tones";
import { useReady } from "@/components/shared/use-ready";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip as Hint, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { ModuleUnavailable } from "@/components/shared/module-unavailable";
import { moduleEnabled } from "@/lib/business-types";
import { toE164India } from "@/lib/phone";
import { useBusiness } from "@/lib/business-context";
import { record } from "@/lib/record";
import type { ChipTone, Lead, LeadSource, LeadStage } from "@/lib/types";

const stages: { id: LeadStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "qualified", label: "Qualified" },
  { id: "visit", label: "Visit" },
  { id: "quotation", label: "Quotation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

const sources: Array<LeadSource | "All"> = ["All", "Website", "WhatsApp", "Google", "Walk-in", "Meta ad"];

function scoreTone(score: number): ChipTone {
  if (score >= 75) return "mint";
  if (score >= 50) return "sand";
  return "rose";
}

export default function SalesPage() {
  const { business, setLeadStage } = useBusiness();
  const ready = useReady();
  const [tab, setTab] = useState("pipeline");
  const [source, setSource] = useState<(typeof sources)[number]>("All");
  const [score, setScore] = useState("All");
  const [status, setStatus] = useState("All");
  const [active, setActive] = useState<Lead | null>(null);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [doneFollowUps, setDoneFollowUps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDraft(active?.draft ?? "");
  }, [active]);

  const stageLabel = (id: LeadStage) => (id === "visit" ? business.visitLabel : stages.find((item) => item.id === id)?.label ?? id);

  const filtered = useMemo(() => {
    return business.leads.filter((lead) => {
      if (source !== "All" && lead.source !== source) return false;
      if (score === "70+" && lead.score < 70) return false;
      if (score === "40-69" && (lead.score < 40 || lead.score > 69)) return false;
      if (score === "Under 40" && lead.score >= 40) return false;
      if (status === "AI qualified" && !lead.aiQualified) return false;
      if (status === "Duplicate" && !lead.duplicate) return false;
      if (status === "Never contacted" && !lead.neverContacted) return false;
      return true;
    });
  }, [business.leads, score, source, status]);

  if (!moduleEnabled(business.type, "sales")) return <ModuleUnavailable module="Leads" type={business.type} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IllustrativeNote />
        {business.type === "interior" ? (
          <Link href="/outreach" className="text-sm font-medium text-accent">
            Qualification inbox
          </Link>
        ) : null}
        <p className="text-sm text-secondary">
          Columns run New, Qualified, {business.visitLabel}, Quotation, Won, Lost.
        </p>
      </div>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Lead recovery</p>
          <p className="text-sm text-secondary">{business.recoveryCount} leads were never contacted.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setTab("leads");
            setStatus("Never contacted");
            setSource("All");
            setScore("All");
          }}
        >
          Review leads
        </Button>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          {!ready ? (
            <Card className="p-6">
              <ListSkeleton rows={4} />
            </Card>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {stages.map((stage) => {
                const cards = business.leads.filter((lead) => lead.stage === stage.id);
                return (
                  <div key={stage.id} className="w-[270px] shrink-0 rounded-card border border-line bg-white p-3 shadow-card">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <p className="text-sm font-semibold">{stageLabel(stage.id)}</p>
                      <span className="text-[12px] text-secondary">{cards.length}</span>
                    </div>
                    <div className="space-y-2">
                      {cards.length === 0 ? (
                        <p className="rounded-inner border border-dashed border-line px-3 py-6 text-center text-[13px] text-secondary">
                          Nothing in this stage
                        </p>
                      ) : (
                        cards.map((lead) => (
                          <button
                            key={lead.id}
                            onClick={() => setActive(lead)}
                            className="w-full rounded-inner border border-line bg-white p-3 text-left transition-shadow hover:shadow-card"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold">{lead.name}</p>
                              <StatusChip tone={scoreTone(lead.score)}>{lead.score}</StatusChip>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <StatusChip tone={sourceTone[lead.source]}>{lead.source}</StatusChip>
                              {lead.aiQualified ? <StatusChip tone="lavender">AI qualified</StatusChip> : null}
                              {lead.duplicate ? (
                                <Hint>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center text-chip-sand-ink" aria-label="Possible duplicate">
                                      <Flag className="h-3.5 w-3.5" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>Possible duplicate</TooltipContent>
                                </Hint>
                              ) : null}
                            </div>
                            <p className="mt-2 text-[13px] text-secondary">{lead.budget}</p>
                            <p className="text-[12px] text-secondary">{lead.location}</p>
                            <p className="mt-1 text-[12px] text-secondary">Last contact · {lead.lastContact}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leads">
          <Card className="p-4 md:p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              <Filter label="Source" value={source} onChange={setSource} options={sources} />
              <Filter label="Score" value={score} onChange={setScore} options={["All", "70+", "40-69", "Under 40"]} />
              <Filter
                label="Status"
                value={status}
                onChange={setStatus}
                options={["All", "AI qualified", "Duplicate", "Never contacted"]}
              />
            </div>
            {!ready ? (
              <ListSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Inbox} title="No leads match" description="Widen the source, score, or status filter." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead) => (
                    <TableRow key={lead.id} className="cursor-pointer" onClick={() => setActive(lead)}>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 font-medium">
                          {lead.name}
                          {lead.duplicate ? (
                            <Flag className="h-3.5 w-3.5 text-chip-sand-ink" aria-label="Possible duplicate" />
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusChip tone={sourceTone[lead.source]}>{lead.source}</StatusChip>
                      </TableCell>
                      <TableCell>
                        <StatusChip tone={scoreTone(lead.score)}>{lead.score}</StatusChip>
                      </TableCell>
                      <TableCell>{lead.budget}</TableCell>
                      <TableCell>{lead.location}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {lead.aiQualified ? <StatusChip tone="lavender">AI qualified</StatusChip> : null}
                          {lead.neverContacted ? <StatusChip tone="rose">Needs attention</StatusChip> : null}
                          {sent[lead.id] ? <StatusChip tone="sand">Opened in WhatsApp</StatusChip> : null}
                          {!lead.aiQualified && !lead.neverContacted && !sent[lead.id] ? (
                            <span className="text-[13px] text-secondary">{stageLabel(lead.stage)}</span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="followups">
          <Card className="p-4 md:p-6">
            <SectionHeader title="Due follow-ups" description="Showing a sample of the pending list." />
            {!ready ? (
              <div className="mt-4">
                <ListSkeleton />
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {business.followUps.map((item) => (
                  <li key={item.id} className="flex flex-col gap-3 rounded-inner border border-line px-3 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="text-[13px] text-secondary">
                        {item.reason} · {item.channel} · {item.due}
                      </p>
                    </div>
                    {doneFollowUps[item.id] ? (
                      <StatusChip tone="mint">Done</StatusChip>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setDoneFollowUps((current) => ({ ...current, [item.id]: true }));
                          record(business.id, "followup.done", item.name);
                          toast({ title: "Follow-up marked done", description: `${item.name} is saved. No message was sent.` });
                        }}
                      >
                        Mark done
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-6">
              <SectionHeader title="Funnel" />
              <IllustrativeNote />
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={business.funnel}>
                    <CartesianGrid stroke="#E7EBF5" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltip} />
                    <Bar dataKey="value" fill="#3D6EE0" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-6">
              <SectionHeader title="Conversion rate by source" />
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={business.sources} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid stroke="#E7EBF5" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                    <YAxis type="category" dataKey="source" tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={chartTooltip} />
                    <Bar dataKey="rate" fill="#8FA9F3" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-6 xl:col-span-2">
              <SectionHeader title="Salesperson leaderboard" />
              <ul className="mt-4 grid gap-3 md:grid-cols-3">
                {business.leaders.map((leader) => (
                  <li key={leader.name} className="flex items-center gap-3 rounded-inner border border-line p-3 hover:bg-accent-tint/40">
                    <Avatar>
                      <AvatarFallback>{leader.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{leader.name}</p>
                      <p className="text-[13px] text-secondary">
                        {leader.deals} · {leader.revenue}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent className="w-[min(100%,520px)]">
          {active ? (
            <>
              <SheetHeader>
                <SheetTitle>{active.name}</SheetTitle>
                <SheetDescription>
                  {active.phone} · {active.location}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="flex flex-wrap gap-1">
                  <StatusChip tone={sourceTone[active.source]}>{active.source}</StatusChip>
                  <StatusChip tone={scoreTone(active.score)}>Score {active.score}</StatusChip>
                  {active.aiQualified ? <StatusChip tone="lavender">AI qualified</StatusChip> : null}
                  {active.duplicate ? <StatusChip tone="sand">Possible duplicate</StatusChip> : null}
                  {sent[active.id] ? <StatusChip tone="sand">Opened in WhatsApp, not confirmed sent</StatusChip> : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Info label="Budget" value={active.budget} />
                  <Info label="Location" value={active.location} />
                </div>
                <Info label="Requirements" value={active.requirements} />
                <div>
                  <p className="text-[13px] font-medium text-secondary">Conversation</p>
                  <ol className="mt-2 space-y-3">
                    {active.timeline.map((item) => (
                      <li key={item.at + item.text} className="border-l-2 border-line pl-3">
                        <p className="text-[12px] text-secondary">
                          {item.at} · {item.from === "brain" ? "Business Brain" : item.from === "team" ? "Team" : "Lead"}
                        </p>
                        <p className="text-sm">{item.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <BrainMark label="AI-drafted follow-up" />
                  </div>
                  <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Follow-up message" />
                  <label className="mt-3 block text-[12px] text-secondary">
                  Stage
                  <select
                    className="ml-2 h-9 rounded-inner border border-line bg-white px-2 text-sm text-ink"
                    value={active.stage}
                    onChange={(event) => {
                      const stage = event.target.value as LeadStage;
                      setLeadStage(active.id, stage);
                      setActive({ ...active, stage });
                    }}
                  >
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stageLabel(stage.id)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                    className="mt-3"
                    onClick={() => {
                      const phone = toE164India(active.phone);
                      if (!phone) {
                        toast({ title: "No WhatsApp number", description: "This lead does not have a valid Indian mobile number." });
                        return;
                      }
                      window.open(`https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(draft)}`, "_blank", "noopener,noreferrer");
                      setSent((current) => ({ ...current, [active.id]: true }));
                      record(business.id, "whatsapp.open", active.name);
                      toast({ title: "Opened in WhatsApp", description: "Delivery is not confirmed. Nothing was marked as sent." });
                    }}
                  >
                    Open in WhatsApp
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-inner border border-line px-3 py-2">
      <p className="text-[12px] text-secondary">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function Filter<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly T[] | T[];
}) {
  return (
    <label className="text-[12px] text-secondary">
      {label}
      <select
        className="ml-2 h-9 rounded-inner border border-line bg-white px-2 text-sm text-ink"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
