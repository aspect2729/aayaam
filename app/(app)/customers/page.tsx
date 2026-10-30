"use client";

import { useState } from "react";
import { Inbox, Send } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { StatusChip } from "@/components/shared/status-chip";
import { useReady } from "@/components/shared/use-ready";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { useBusiness } from "@/lib/business-context";
import { record } from "@/lib/record";
import type { ChipTone, Customer, CustomerSegment } from "@/lib/types";
import { cn } from "@/lib/utils";

const segments: Array<"All" | CustomerSegment | "Inactive 15+ days"> = [
  "All",
  "New",
  "Active",
  "Inactive 15+ days",
  "Renewal due",
  "High value",
];

const consentTone: Record<Customer["consent"], ChipTone> = {
  "Opted in": "mint",
  Pending: "sand",
  "Opted out": "rose",
};

export default function CustomersPage() {
  const { business } = useBusiness();
  const ready = useReady();
  const [view, setView] = useState<"people" | "journeys">("people");
  const [segment, setSegment] = useState<(typeof segments)[number]>("All");
  const [active, setActive] = useState<Customer | null>(null);
  const [extra, setExtra] = useState<Record<string, { from: "us"; text: string; time: string }[]>>({});
  const [composer, setComposer] = useState("");
  const [journeys, setJourneys] = useState(business.journeys);

  const people = business.customers.filter((customer) => {
    if (segment === "All") return true;
    if (segment === "Inactive 15+ days") return customer.segment === "Inactive";
    return customer.segment === segment;
  });

  const messages = active ? [...active.messages, ...(extra[active.id] ?? [])] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IllustrativeNote />
        <div className="flex rounded-full bg-[#F4F7FE] p-1">
          {(["people", "journeys"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setView(item)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-medium capitalize",
                view === item ? "bg-white text-accent shadow-card" : "text-secondary"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {view === "people" ? (
        <Card className="p-4 md:p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {segments.map((item) => (
              <button
                key={item}
                onClick={() => setSegment(item)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[13px]",
                  segment === item ? "border-accent bg-accent-tint text-accent" : "border-line text-secondary hover:bg-accent-tint/60"
                )}
              >
                {item}
              </button>
            ))}
          </div>
          {!ready ? (
            <ListSkeleton />
          ) : people.length === 0 ? (
            <EmptyState icon={Inbox} title="No customers in this segment" description="Try All, or another pill." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Consent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer" onClick={() => setActive(customer)}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.segment === "Inactive" ? "Inactive 15+ days" : customer.segment}</TableCell>
                    <TableCell>{customer.city}</TableCell>
                    <TableCell>{customer.value}</TableCell>
                    <TableCell>{customer.lastSeen}</TableCell>
                    <TableCell>
                      <StatusChip tone={consentTone[customer.consent]}>{customer.consent}</StatusChip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {journeys.map((journey) => (
            <Card key={journey.id} className="p-5 transition-shadow hover:shadow-cardHover">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] text-secondary">Journey</p>
                  <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{journey.name}</h2>
                </div>
                <Switch
                  checked={journey.enabled}
                  onCheckedChange={(checked) =>
                    setJourneys((current) => current.map((item) => (item.id === journey.id ? { ...item, enabled: checked } : item)))
                  }
                  aria-label={`${journey.name} journey`}
                />
              </div>
              <p className="mt-2 text-sm text-secondary">{journey.description}</p>
              <div className="mt-3">
                <StatusChip tone="mint">Approved template</StatusChip>
              </div>
              <p className="mt-3 rounded-inner border border-line bg-accent-tint/40 px-3 py-2 text-sm">{journey.template}</p>
              <p className="mt-3 text-[12px] text-secondary">{journey.enabled ? "Running" : "Off"}</p>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent className="w-[min(100%,480px)]">
          {active ? (
            <>
              <SheetHeader>
                <SheetTitle>{active.name}</SheetTitle>
                <SheetDescription>
                  {active.phone} · {active.city}
                </SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex flex-wrap gap-2 px-5 pt-4">
                  <StatusChip tone={consentTone[active.consent]}>{active.consent}</StatusChip>
                  <StatusChip tone="blue">{active.segment === "Inactive" ? "Inactive 15+ days" : active.segment}</StatusChip>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
                  <p className="text-[13px] font-medium text-secondary">WhatsApp</p>
                  {messages.map((message, index) => (
                    <div
                      key={`${message.time}-${index}`}
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                        message.from === "us"
                          ? "ml-auto rounded-br-md bg-chip-blue text-chip-blue-ink"
                          : "rounded-bl-md bg-[#F4F6FB] text-ink"
                      )}
                    >
                      <p>{message.text}</p>
                      <p className="mt-1 text-[11px] opacity-80">{message.time}</p>
                    </div>
                  ))}
                  <p className="pt-3 text-[13px] font-medium text-secondary">History</p>
                  <ul className="space-y-2">
                    {active.history.map((item) => (
                      <li key={item.label + item.date} className="flex items-center justify-between rounded-inner border border-line px-3 py-2 text-sm">
                        <span>
                          {item.label}
                          <span className="block text-[12px] text-secondary">{item.date}</span>
                        </span>
                        <span className="font-medium tabular-nums">{item.amount}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <form
                  className="flex gap-2 border-t border-line p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!composer.trim()) return;
                    setExtra((current) => ({
                      ...current,
                      [active.id]: [
                        ...(current[active.id] ?? []),
                        { from: "us", text: composer.trim(), time: "Now" },
                      ],
                    }));
                    setComposer("");
                    record(business.id, "message.draft", `${active.name}: ${composer.trim()}`);
                    toast({ title: "Reply saved", description: "It is on this customer. WhatsApp was not sent." });
                  }}
                >
                  <Input value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="Write a WhatsApp reply" aria-label="WhatsApp reply" />
                  <Button type="submit" size="icon" aria-label="Add reply to preview">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
