"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { EmptyState } from "@/components/shared/empty-state";
import { PastelEventBlock } from "@/components/shared/pastel-event-block";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useBusiness } from "@/lib/business-context";
import { cn } from "@/lib/utils";
import type { ChipTone } from "@/lib/types";

const startHour = 8;
const endHour = 19;
const hourHeight = 68;

function istCalendarDate(offset: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = parts.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offset);
  return date;
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

const priorityTone: Record<string, ChipTone> = { High: "rose", Medium: "sand", Low: "blue" };

export default function OperationsPage() {
  const { business, extraTasks } = useBusiness();
  const [offset, setOffset] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [flows, setFlows] = useState(business.workflows);
  const [visits, setVisits] = useState<{ id: string; designer_name: string; start_at: string; address: string; lead_id: string }[]>([]);

  useEffect(() => {
    if (business.type !== "interior") return;
    void fetch(`/api/outreach?workspace=${business.id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.visits) setVisits(body.visits);
      })
      .catch(() => setVisits([]));
  }, [business.id, business.type]);

  const date = useMemo(() => istCalendarDate(offset), [offset]);

  const heading = date.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  const weekday = date.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const showEvents = offset === 0;

  return (
    <div className="space-y-4">
      <IllustrativeNote />
      <Card className="p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="rounded-full" onClick={() => setOffset(0)}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setOffset((value) => value - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Next day" onClick={() => setOffset((value) => value + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-secondary">{business.name}</p>
        </div>
        <h2 className="mt-4 text-[32px] font-semibold tracking-[-0.02em] md:text-[40px]">{heading}</h2>
        <p className="text-sm text-secondary">{weekday}</p>

        {showEvents ? (
          <div className="mt-6 flex">
            <div className="w-16 shrink-0">
              {hours.map((hour) => (
                <div key={hour} className="pr-2 text-right text-[12px] text-secondary" style={{ height: hourHeight }}>
                  {hour}:00
                </div>
              ))}
            </div>
            <div className="relative flex-1 border-l border-line" style={{ height: hours.length * hourHeight }}>
              {hours.map((hour) => (
                <div key={hour} className="border-t border-line" style={{ height: hourHeight }} />
              ))}
              {business.events.map((event) => {
                const top = ((toMinutes(event.start) - startHour * 60) / 60) * hourHeight;
                const height = Math.max(((toMinutes(event.end) - toMinutes(event.start)) / 60) * hourHeight - 6, 36);
                return (
                  <div key={event.id} className="absolute left-2 right-2" style={{ top: top + 4, height }}>
                    <PastelEventBlock title={event.title} time={`${event.start}–${event.end}`} detail={event.detail} tone={event.tone} className="h-full" />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState icon={CalendarDays} title="Nothing on this sample day" description="Return to today to see the illustrative schedule." />
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHeader title="Tasks" description="Includes anything you created from Business Brain." />
          <ul className="mt-4 space-y-2">
            {extraTasks.map((task) => (
              <li key={task.id} className="rounded-inner border border-line px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{task.title}</p>
                  <StatusChip tone="lavender">Created by Business Brain</StatusChip>
                </div>
              </li>
            ))}
            {business.tasks.map((task) => (
              <li key={task.id} className={cn("rounded-inner border border-line px-3 py-3", done[task.id] && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[#3D6EE0]"
                    checked={!!done[task.id]}
                    onChange={() => setDone((current) => ({ ...current, [task.id]: !current[task.id] }))}
                    aria-label={`Mark ${task.title} done`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">{task.initials}</AvatarFallback>
                      </Avatar>
                      <span className="text-[12px] text-secondary">{task.assignee}</span>
                      <span className="text-[12px] text-secondary">Due {task.due}</span>
                      <StatusChip tone={priorityTone[task.priority]}>{task.priority}</StatusChip>
                      {task.fromBrain ? <StatusChip tone="lavender">Created by Business Brain</StatusChip> : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <SectionHeader title="Workflow templates" description={`${business.typeLabel} routines for this workspace.`} />
          <ul className="mt-4 space-y-3">
            {flows.map((flow) => (
              <li key={flow.id} className="flex items-start justify-between gap-3 rounded-inner border border-line px-3 py-3">
                <div>
                  <p className="text-sm font-semibold">{flow.name}</p>
                  <p className="mt-1 text-sm text-secondary">{flow.detail}</p>
                </div>
                <Switch
                  checked={flow.enabled}
                  onCheckedChange={(checked) =>
                    setFlows((current) => current.map((item) => (item.id === flow.id ? { ...item, enabled: checked } : item)))
                  }
                  aria-label={flow.name}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {business.type === "interior" ? (
        <Card className="p-4 md:p-6">
          <SectionHeader title="Site visits" description="Booked from qualification. Google Calendar is not connected." />
          {visits.length === 0 ? (
            <p className="mt-3 text-sm text-secondary">No site visit is booked yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {visits.map((visit) => (
                <li key={visit.id} className="rounded-inner border border-line px-3 py-3 text-sm">
                  <span className="font-medium">{new Date(visit.start_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                  <span className="text-secondary"> · {visit.designer_name} · {visit.address}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
