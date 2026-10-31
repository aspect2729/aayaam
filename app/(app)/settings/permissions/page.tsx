"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { businessTypeConfig } from "@/lib/business-types";
import { useBusiness } from "@/lib/business-context";
import { exampleRule, permissionRows } from "@/lib/mock-data";
import type { BusinessType } from "@/lib/types";

export default function PermissionsPage() {
  const { business, setBusinessType } = useBusiness();
  const [rows, setRows] = useState(permissionRows);
  const [ruleOn, setRuleOn] = useState(true);
  const [health, setHealth] = useState("Checking the database…");

  useEffect(() => {
    void fetch("/api/health")
      .then((response) => response.json())
      .then((body) => {
        setHealth(`${body.local} Supabase: ${body.supabase}. ${body.migrations} ${body.backup}`);
      })
      .catch(() => setHealth("The local database did not respond."));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader
          title="Hybrid autonomy"
          description="Read and routine work can run. Messages follow a rule or an approval. Money changes stay locked."
        />
        <IllustrativeNote />
      </div>
      <Card className="p-6">
        <SectionHeader title="Database" description={health} />
      </Card>
      <Card className="p-6">
        <SectionHeader title="Business type" description={businessTypeConfig[business.type].title} />
        <p className="mt-2 text-sm text-secondary">Changing the type hides modules. Records stay on this business.</p>
        <select
          className="mt-3 h-10 rounded-inner border border-line bg-white px-3 text-sm"
          value={business.type}
          aria-label="Business type"
          onChange={(event) => {
            const next = event.target.value as BusinessType;
            if (next === business.type) return;
            const confirmed = window.confirm(`Show ${businessTypeConfig[next].title} modules? No records will be deleted.`);
            if (confirmed) setBusinessType(next);
          }}
        >
          {(Object.keys(businessTypeConfig) as BusinessType[]).map((type) => (
            <option key={type} value={type}>
              {businessTypeConfig[type].title}
            </option>
          ))}
        </select>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[12px] text-secondary">
                <th className="px-6 py-3 font-medium">Action category</th>
                <th className="px-3 py-3 font-medium">What it covers</th>
                <th className="px-3 py-3 font-medium">Autonomy</th>
                <th className="px-6 py-3 font-medium">Control</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-4 font-medium">{row.category}</td>
                  <td className="px-3 py-4 text-secondary">{row.examples}</td>
                  <td className="px-3 py-4">
                    {row.select ? (
                      <select
                        className="h-9 rounded-inner border border-line bg-white px-2 text-sm"
                        value={row.mode}
                        aria-label={`${row.category} autonomy`}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item) => (item.id === row.id ? { ...item, mode: event.target.value } : item))
                          )
                        }
                      >
                        {row.select.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <StatusChip tone={row.locked && !row.on ? "rose" : "blue"}>{row.mode}</StatusChip>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Switch
                      checked={row.on}
                      disabled={row.locked}
                      aria-label={row.category}
                      onCheckedChange={(checked) =>
                        setRows((current) => current.map((item) => (item.id === row.id ? { ...item, on: checked } : item)))
                      }
                    />
                    {row.locked ? <p className="mt-1 text-[12px] text-secondary">Locked</p> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] text-secondary">Example rule</p>
            <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em]">{exampleRule.title}</h2>
            <p className="mt-2 text-sm text-secondary">{exampleRule.detail}</p>
          </div>
          <Switch checked={ruleOn} onCheckedChange={setRuleOn} aria-label="Renewal reminder rule" />
        </div>
        <p className="mt-4 text-sm">{ruleOn ? "Rule is on for this preview." : "Rule is off. Reminders will wait for a manual send."}</p>
      </Card>
      <Link href="/onboarding" className="inline-block text-sm font-medium text-accent">
        Replay the setup guide
      </Link>
    </div>
  );
}
