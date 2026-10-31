"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusChip } from "@/components/shared/status-chip";

type Row = { name: string; flag: string; state: string; missing: string[] };

export default function SystemPage() {
  const [body, setBody] = useState<{ supabase: string; backup: string; jobs: string; flags: Row[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/system/status")
      .then((response) => response.json())
      .then((next) => setBody(next))
      .catch(() => setError("System status did not load."));
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <SectionHeader title="System status" description="Keys are never shown. A flag stays off until it is set to 1." />
        {error ? <p className="mt-3 text-sm text-secondary">{error}</p> : null}
        {body ? (
          <ul className="mt-4 space-y-2 text-sm text-secondary">
            <li>Supabase: {body.supabase}</li>
            <li>Backup: {body.backup}</li>
            <li>Jobs: {body.jobs}</li>
          </ul>
        ) : null}
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {(body?.flags ?? []).map((row) => (
          <Card key={row.flag} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="mt-1 text-[12px] text-secondary">{row.flag}</p>
                {row.missing.length ? <p className="mt-1 text-[12px] text-secondary">Missing {row.missing.join(", ")}</p> : null}
              </div>
              <StatusChip tone={row.state === "enabled" ? "mint" : "sand"}>{row.state}</StatusChip>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
