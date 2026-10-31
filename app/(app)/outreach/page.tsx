"use client";

import { useEffect, useMemo, useState } from "react";
import { Inbox, Phone } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { ModuleUnavailable } from "@/components/shared/module-unavailable";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusChip } from "@/components/shared/status-chip";
import { useReady } from "@/components/shared/use-ready";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useBusiness } from "@/lib/business-context";
import { windowRemainingMs } from "@/lib/qualification/window";

type LeadRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  language: string;
  stage: string;
  score: number;
  score_reasons_json: string;
  outcome_reason: string | null;
  human_active: number;
  awaiting_field: string | null;
  demo: number;
};
type MessageRow = { id: string; lead_id: string; direction: string; channel: string; body: string; status: string; error: string | null; origin: string; policy_id: string | null; cost_category: string | null; created_at: string };
type AnswerRow = { lead_id: string; field: string; value: string; normalized: string; confidence: number; source_message_id: string | null; verified: number };
type Snapshot = {
  config: { autonomy: string; assistantName: string; minBudgetPaise: number; quietStart: string; quietEnd: string; threshold: number; address: string; hours: string; portfolio: string; dailyCap: number; areas: string[] };
  channels: { whatsapp: { state: string; detail: string }; email: { state: string; detail: string }; call: { state: string; detail: string } };
  leads: LeadRow[];
  messages: MessageRow[];
  answers: AnswerRow[];
  sequences: { id: string; key: string; name: string; status: string }[];
  steps: { sequence_id: string; position: number; offset_days: number; template_name: string; category: string }[];
  templates: { id: string; name: string; channel: string; category: string; language: string; body: string; provider_status: string }[];
  questions: { field: string; position: number; prompt: string; optional: boolean }[];
  callInterest: number;
  window: { lead_id: string; window_expires_at: string | null; ai_active: number }[];
  analytics: { qualified: { leadIds: string[] }; booked: { leadIds: string[] }; cold: { leadIds: string[] }; needsReview: { leadIds: string[] }; notAFit: { leadIds: string[] }; bySource: { source: string; leadIds: string[] }[] };
};

function statusText(message: MessageRow) {
  if (message.origin === "demo") return "Sample reply, not from WhatsApp";
  if (message.origin === "operator" && message.direction === "inbound") return "Typed in Aayaam, not received from WhatsApp";
  if (message.origin === "operator") return "Saved in Aayaam, not sent";
  if (message.status === "awaiting_provider") return "Not sent. The provider has not confirmed it";
  if (message.status === "queued") return "Waiting for approval";
  if (message.status === "scheduled") return "Scheduled, not sent";
  if (message.status === "sent") return "Provider confirmed sent";
  if (message.status === "delivered") return "Delivered";
  if (message.status === "read") return "Read";
  if (message.status === "failed") return message.error || "Failed";
  if (message.status === "received" && message.origin === "webhook") return "Received from the provider";
  return message.status;
}

export default function OutreachPage() {
  const { business } = useBusiness();
  if (business.type !== "interior") return <ModuleUnavailable module="Qualification" type={business.type} />;
  return <OutreachDesk workspace={business.id} />;
}

function OutreachDesk({ workspace }: { workspace: string }) {
  const ready = useReady();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("inbox");
  const [filter, setFilter] = useState("All");
  const [focus, setFocus] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [simulation, setSimulation] = useState<{ at: string; channel: string; template: string; body: string }[] | null>(null);

  async function load() {
    setError("");
    const response = await fetch(`/api/outreach?workspace=${workspace}`);
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message || "The qualification desk did not load.");
      return;
    }
    setData(body);
    setSelectedId((current) => current || body.leads?.[0]?.id || null);
  }

  useEffect(() => {
    let cancelled = false;
    setError("");
    void fetch(`/api/outreach?workspace=${workspace}`)
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) {
          setError(body?.error?.message || "The qualification desk did not load.");
          return;
        }
        setData(body);
        setSelectedId((current) => current || body.leads?.[0]?.id || null);
      })
      .catch(() => {
        if (!cancelled) setError("The qualification desk did not load.");
      });
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  async function act(action: string, input: Record<string, unknown>) {
    const response = await fetch("/api/outreach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspace, action, input }) });
    const body = await response.json();
    if (!response.ok) {
      toast({ title: "Not completed", description: body?.error?.message || "The action was not saved." });
      return body;
    }
    if (action !== "simulate") await load();
    return body;
  }

  const leads = useMemo(() => {
    const rows = data?.leads ?? [];
    return rows.filter((lead) => {
      if (focus.length && !focus.includes(lead.id)) return false;
      if (filter === "Needs reply") return data?.messages.some((message) => message.lead_id === lead.id && message.direction === "inbound");
      if (filter === "AI active") return !lead.human_active;
      if (filter === "Human active") return lead.human_active === 1;
      if (filter === "Awaiting approval") return data?.messages.some((message) => message.lead_id === lead.id && message.status === "queued");
      if (filter === "Qualified") return lead.stage === "qualified" || lead.stage === "site_visit_scheduled";
      if (filter === "Cold") return lead.stage === "cold";
      return true;
    });
  }, [data, filter, focus]);

  const selected = leads.find((lead) => lead.id === selectedId) || leads[0] || null;
  const thread = (data?.messages ?? []).filter((message) => message.lead_id === selected?.id);
  const answers = (data?.answers ?? []).filter((answer) => answer.lead_id === selected?.id);
  const windowRow = data?.window.find((item) => item.lead_id === selected?.id);
  const remaining = windowRemainingMs(windowRow?.window_expires_at ?? null, new Date());

  if (!ready || (!data && !error)) {
    return (
      <Card className="p-6">
        <ListSkeleton />
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card className="p-6">
        <EmptyState icon={Inbox} title="Qualification did not load" description={error || "Try again."} />
        <Button className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Qualification" description={`${data.config.assistantName}. External messages stay unsent until a provider confirms them.`} />
        <IllustrativeNote />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap">
          {["inbox", "approvals", "sequences", "templates", "settings", "channels", "analytics", "calling"].map((item) => (
            <TabsTrigger key={item} value={item} className="capitalize">
              {item === "calling" ? "Calling" : item}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="inbox">
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
            <Card className="p-4">
              <label className="text-[12px] text-secondary">
                Filter
                <select className="mt-1 h-9 w-full rounded-inner border border-line bg-white px-2 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Conversation filter">
                  {["All", "Needs reply", "AI active", "Human active", "Awaiting approval", "Qualified", "Cold"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <form
                className="mt-3 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void act("arrive", {
                    name: form.get("name"),
                    phone: form.get("phone"),
                    email: form.get("email"),
                    source: "Website",
                    consents: form.get("whatsapp") ? [{ channel: "whatsapp", basis: "form checkbox", source: "qualification desk" }] : [],
                  }).then(() => toast({ title: "Lead saved", description: "A first message is attempted only when consent and a provider allow it." }));
                  event.currentTarget.reset();
                }}
              >
                <Input name="name" placeholder="Name" aria-label="Lead name" required />
                <Input name="phone" placeholder="Phone" aria-label="Phone" />
                <Input name="email" placeholder="Email" aria-label="Email" />
                <label className="flex items-center gap-2 text-[12px] text-secondary">
                  <input type="checkbox" name="whatsapp" /> WhatsApp consent
                </label>
                <Button type="submit" size="sm">Save lead</Button>
              </form>
              {leads.length === 0 ? <p className="mt-4 text-sm text-secondary">No leads in this filter.</p> : (
                <ul className="mt-4 space-y-2">
                  {leads.map((lead) => (
                    <li key={lead.id}>
                      <button type="button" className="w-full rounded-inner border border-line px-3 py-2 text-left hover:bg-accent-tint/40" onClick={() => setSelectedId(lead.id)}>
                        <span className="block text-sm font-semibold">{lead.name}</span>
                        <span className="text-[12px] text-secondary">{lead.stage} · score {lead.score}{lead.demo ? " · Demo" : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-4">
              {selected ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{selected.name}</p>
                      <p className="text-[12px] text-secondary">{selected.phone || "No phone"} · {selected.email || "No email"} · {selected.language}</p>
                    </div>
                    <StatusChip tone={selected.human_active ? "sand" : "lavender"}>{selected.human_active ? "Human active" : "Assistant active"}</StatusChip>
                  </div>
                  <p className="mt-2 text-[12px] text-secondary">
                    {remaining > 0 ? `WhatsApp window ${Math.ceil(remaining / 60000)} min left` : "WhatsApp customer-service window is closed. The next business message must be a template."}
                  </p>
                  <ol className="mt-4 space-y-3">
                    {thread.length === 0 ? <li className="text-sm text-secondary">No messages yet.</li> : thread.map((message) => (
                      <li key={message.id} className="rounded-inner border border-line px-3 py-2">
                        <p className="text-[12px] text-secondary">{message.direction} · {message.channel} · {new Date(message.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                        <p className="mt-1 text-sm">{message.body}</p>
                        <p className="mt-1 text-[12px] text-secondary">{statusText(message)}{message.cost_category ? ` · ${message.cost_category} price not estimated` : ""}</p>
                        {message.status === "queued" ? (
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" onClick={() => void act("approve", { messageId: message.id }).then((result) => toast({ title: result?.status === "sent" ? "Provider confirmed sent" : "Not confirmed sent", description: result?.status === "sent" ? "The test provider returned an id." : "The provider did not confirm delivery." }))}>Approve</Button>
                            <Button size="sm" variant="secondary" onClick={() => void act("reject", { messageId: message.id })}>Reject</Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  <Textarea className="mt-4" value={reply} onChange={(event) => setReply(event.target.value)} aria-label="Reply typed in Aayaam" placeholder="Type the lead's reply to extract it here" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void act("inbound", { leadId: selected.id, text: reply }).then(() => { setReply(""); toast({ title: "Reply saved in Aayaam", description: "This was typed here. It was not received from WhatsApp." }); })}>Save reply</Button>
                    <Button size="sm" variant="secondary" onClick={() => void act("reply", { leadId: selected.id, body: note }).then(() => toast({ title: "Reply saved", description: "Nothing was sent to WhatsApp or email." }))}>Save team note</Button>
                    {selected.human_active ? (
                      <Button size="sm" onClick={() => void act("handback", { leadId: selected.id })}>Hand back to assistant</Button>
                    ) : (
                      <Button size="sm" onClick={() => void act("takeover", { leadId: selected.id })}>Take over</Button>
                    )}
                  </div>
                  <Textarea className="mt-2" value={note} onChange={(event) => setNote(event.target.value)} aria-label="Team note" placeholder="Team note. This is not sent." />
                </>
              ) : <EmptyState icon={Inbox} title="No conversation selected" description="Save a lead to start qualification." />}
            </Card>
            <Card className="p-4">
              <SectionHeader title="Qualification" description={selected ? `Score ${selected.score}` : "Select a lead"} />
              {selected ? (
                <ul className="mt-3 space-y-2">
                  {(JSON.parse(selected.score_reasons_json || "[]") as string[]).map((reason) => <li key={reason} className="text-[12px] text-secondary">{reason}</li>)}
                  {data.questions.map((question) => {
                    const answer = answers.find((item) => item.field === question.field);
                    const source = thread.find((message) => message.id === answer?.source_message_id);
                    return (
                      <li key={question.field} className="rounded-inner border border-line px-3 py-2" title={source ? `From ${source.origin} reply, ${new Date(source.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}` : "No source message"}>
                        <p className="text-[12px] text-secondary">{question.prompt}</p>
                        <p className="text-sm">{answer ? `${answer.normalized || "Unverified"} · ${Math.round(answer.confidence * 100)}%` : "Pending"}</p>
                      </li>
                    );
                  })}
                  <li><StatusChip tone="lavender">{selected.stage}</StatusChip></li>
                </ul>
              ) : null}
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="approvals">
          <Card className="p-4">
            <SectionHeader title="Approval centre" description="Queued messages. Approving does not mean sent unless the provider returns an id." />
            <ul className="mt-4 space-y-3">
              {data.messages.filter((message) => message.status === "queued").length === 0 ? <li className="text-sm text-secondary">Nothing is waiting.</li> : data.messages.filter((message) => message.status === "queued").map((message) => (
                <li key={message.id} className="rounded-inner border border-line px-3 py-3">
                  <p className="text-sm font-semibold">{data.leads.find((lead) => lead.id === message.lead_id)?.name}</p>
                  <p className="mt-1 text-sm">{message.body}</p>
                  <p className="mt-1 text-[12px] text-secondary">{message.channel} · {message.policy_id || "No policy"} · {statusText(message)}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => void act("approve", { messageId: message.id })}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => void act("reject", { messageId: message.id })}>Reject</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
        <TabsContent value="sequences">
          <Card className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void act("pause", { paused: true })}>Pause all</Button>
              <Button size="sm" variant="secondary" onClick={() => void act("resume", {})}>Resume all</Button>
              <Button size="sm" onClick={() => selected && void act("simulate", { leadId: selected.id }).then((body) => { setSimulation(body.steps || []); toast({ title: "Simulation", description: "Nothing was sent." }); })}>Simulate 14 days</Button>
            </div>
            <ul className="mt-4 space-y-3">
              {data.sequences.map((sequence) => (
                <li key={sequence.id} className="rounded-inner border border-line px-3 py-3">
                  <p className="text-sm font-semibold">{sequence.name} · {sequence.status}</p>
                  <ul className="mt-2 space-y-1 text-[13px] text-secondary">
                    {data.steps.filter((step) => step.sequence_id === sequence.id).map((step) => (
                      <li key={`${sequence.id}-${step.position}`}>Day {step.offset_days} · {step.template_name} · {step.category}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {simulation ? (
              <div className="mt-4">
                <p className="text-sm font-semibold">Simulation. Nothing was sent.</p>
                <ul className="mt-2 space-y-2">
                  {simulation.map((step) => <li key={step.at + step.template} className="text-sm text-secondary">{new Date(step.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {step.channel} · {step.template}</li>)}
                </ul>
              </div>
            ) : null}
          </Card>
        </TabsContent>
        <TabsContent value="templates">
          <Card className="p-4">
            <SectionHeader title="Templates" description="Local copies. Meta approval is not submitted from here." />
            <ul className="mt-4 space-y-2">
              {data.templates.filter((template) => template.channel === "whatsapp").map((template) => (
                <li key={template.id} className="rounded-inner border border-line px-3 py-3">
                  <p className="text-sm font-semibold">{template.name} · {template.language} · {template.category}</p>
                  <p className="mt-1 text-sm text-secondary">{template.body}</p>
                  <p className="mt-1 text-[12px] text-secondary">Provider status: {template.provider_status}</p>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          <Card className="p-4">
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void act("settings", {
                  autonomy: form.get("autonomy"),
                  assistantName: form.get("assistantName"),
                  quietStart: form.get("quietStart"),
                  quietEnd: form.get("quietEnd"),
                  address: form.get("address"),
                  hours: form.get("hours"),
                  portfolio: form.get("portfolio"),
                  dailyCap: Number(form.get("dailyCap")),
                  minBudgetPaise: Number(form.get("minBudget")) * 100,
                }).then(() => toast({ title: "Settings saved", description: "Existing leads were not deleted." }));
              }}
            >
              <label className="text-sm">Autonomy
                <select name="autonomy" defaultValue={data.config.autonomy} className="mt-1 h-10 w-full rounded-inner border border-line px-2" aria-label="Autonomy">
                  <option value="draft">Draft only</option>
                  <option value="assisted">Assisted</option>
                  <option value="autonomous">Autonomous within guardrails</option>
                </select>
              </label>
              <label className="text-sm">Assistant name
                <Input name="assistantName" defaultValue={data.config.assistantName} aria-label="Assistant name" />
              </label>
              <label className="text-sm">Quiet from
                <Input name="quietStart" defaultValue={data.config.quietStart} aria-label="Quiet start" />
              </label>
              <label className="text-sm">Quiet until
                <Input name="quietEnd" defaultValue={data.config.quietEnd} aria-label="Quiet end" />
              </label>
              <label className="text-sm">Minimum budget in rupees
                <Input name="minBudget" defaultValue={String(data.config.minBudgetPaise / 100)} aria-label="Minimum budget" />
              </label>
              <label className="text-sm">Daily cap
                <Input name="dailyCap" defaultValue={String(data.config.dailyCap)} aria-label="Daily cap" />
              </label>
              <label className="text-sm md:col-span-2">Studio address
                <Input name="address" defaultValue={data.config.address} aria-label="Studio address" />
              </label>
              <label className="text-sm md:col-span-2">Working hours
                <Input name="hours" defaultValue={data.config.hours} aria-label="Working hours" />
              </label>
              <label className="text-sm md:col-span-2">Portfolio link
                <Input name="portfolio" defaultValue={data.config.portfolio} aria-label="Portfolio link" />
              </label>
              <p className="text-sm text-secondary md:col-span-2">Service area: {data.config.areas.join(", ")}</p>
              <Button type="submit">Save settings</Button>
            </form>
          </Card>
        </TabsContent>
        <TabsContent value="channels">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4"><SectionHeader title="WhatsApp" description={data.channels.whatsapp.detail} /><StatusChip tone="sand">{data.channels.whatsapp.state}</StatusChip></Card>
            <Card className="p-4"><SectionHeader title="Email" description={data.channels.email.detail} /><p className="mt-2 text-sm text-secondary">SPF, DKIM, and DMARC are not verified. Add the records at your DNS host, then connect Resend or SES.</p><StatusChip tone="sand">{data.channels.email.state}</StatusChip></Card>
            <Card className="p-4"><SectionHeader title="Calling" description="Coming soon" /><StatusChip tone="sand">Disabled</StatusChip></Card>
          </div>
        </TabsContent>
        <TabsContent value="analytics">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Qualified", data.analytics.qualified.leadIds],
              ["Visits booked", data.analytics.booked.leadIds],
              ["Cold", data.analytics.cold.leadIds],
              ["Needs a person", data.analytics.needsReview.leadIds],
              ["Not a fit", data.analytics.notAFit.leadIds],
            ].map(([label, ids]) => (
              <button key={String(label)} type="button" className="rounded-card border border-line bg-white p-4 text-left" onClick={() => { setFocus(ids as string[]); setTab("inbox"); setFilter("All"); }}>
                <p className="text-[12px] text-secondary">{label as string}</p>
                <p className="text-2xl font-semibold">{(ids as string[]).length}</p>
              </button>
            ))}
          </div>
          <Card className="mt-4 p-4">
            <SectionHeader title="By source" />
            <ul className="mt-3 space-y-2">
              {data.analytics.bySource.map((row) => (
                <li key={row.source}><button type="button" className="text-sm" onClick={() => { setFocus(row.leadIds); setTab("inbox"); }}>{row.source}: {row.leadIds.length}</button></li>
              ))}
            </ul>
          </Card>
        </TabsContent>
        <TabsContent value="calling">
          <Card className="p-6">
            <Phone className="h-5 w-5 text-accent" aria-hidden />
            <SectionHeader title="Calling is coming soon" description="Planned later: click-to-call from a lead, a call outcome note, and voice qualification. Calling in India needs a provider choice and a compliance review, including telecom rules on commercial communication, before any of that is built." />
            <Button className="mt-4" onClick={() => void act("calling-interest", {}).then(() => toast({ title: "Interest saved", description: "No call was placed." }))}>Notify me</Button>
            <p className="mt-2 text-sm text-secondary">{data.callInterest} interest {data.callInterest === 1 ? "note" : "notes"} saved.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
