"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { KpiCard } from "@/components/shared/kpi-card";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusChip } from "@/components/shared/status-chip";
import { chartTooltip } from "@/components/shared/tones";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { financeQuestions } from "@/lib/mock-data";
import { useAskBrain } from "@/lib/ask-brain";
import { useBusiness } from "@/lib/business-context";
import { formatINR } from "@/lib/format";
import type { ProfitRow } from "@/lib/types";

const colors = ["#3D6EE0", "#8FA9F3", "#DCC59B", "#8DCBA2", "#B89DEB"];

type SortKey = "name" | "revenue" | "cost" | "margin";

function marginOf(row: ProfitRow) {
  if (row.cost == null || row.revenue === 0) return null;
  return (row.revenue - row.cost) / row.revenue;
}

export default function FinancePage() {
  const { business } = useBusiness();
  const { openWith } = useAskBrain();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "revenue", dir: "desc" });

  const rows = useMemo(() => {
    const copy = [...business.profitRows];
    copy.sort((a, b) => {
      const value = (row: ProfitRow) => {
        if (sort.key === "name") return row.name;
        if (sort.key === "revenue") return row.revenue;
        if (sort.key === "cost") return row.cost ?? -1;
        return marginOf(row) ?? -1;
      };
      const av = value(a);
      const bv = value(b);
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [business.profitRows, sort]);

  const toggle = (key: SortKey) => {
    setSort((current) => ({ key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" }));
  };

  return (
    <div className="space-y-4">
      <IllustrativeNote />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {business.financeKpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <Card className="p-6">
          <SectionHeader title="Revenue and expenses" />
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={business.months}>
                <CartesianGrid stroke="#E7EBF5" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip contentStyle={chartTooltip} formatter={(value: number) => formatINR(value)} />
                <Area type="monotone" dataKey="revenue" stroke="#3D6EE0" fill="#3D6EE0" fillOpacity={0.12} strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke="#DCC59B" fill="#DCC59B" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <SectionHeader title="Expense breakdown" />
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={business.expenses} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>
                  {business.expenses.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltip} formatter={(value: number) => formatINR(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1 text-sm">
            {business.expenses.map((item, index) => (
              <li key={item.name} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: colors[index % colors.length] }} />
                  {item.name}
                </span>
                <span className="tabular-nums text-secondary">{formatINR(item.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="border-chip-blue-border bg-accent-tint p-4 text-sm text-chip-blue-ink">
        High revenue doesn’t always mean high profit. Margins use your actual cost records.
      </Card>

      <Card className="p-4 md:p-6">
        <SectionHeader title="Product and service profitability" description="Sort any column. Missing cost stays incomplete." />
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Name" onClick={() => toggle("name")} />
              <SortHead label="Revenue" onClick={() => toggle("revenue")} />
              <SortHead label="Cost" onClick={() => toggle("cost")} />
              <SortHead label="Margin" onClick={() => toggle("margin")} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const margin = marginOf(row);
              return (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="tabular-nums">{formatINR(row.revenue)}</TableCell>
                  <TableCell className="tabular-nums">{row.cost == null ? "—" : formatINR(row.cost)}</TableCell>
                  <TableCell>
                    {margin == null ? (
                      <StatusChip tone="sand">Cost missing, profitability incomplete.</StatusChip>
                    ) : (
                      <span className="tabular-nums">{Math.round(margin * 100)}%</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="mt-3 text-[12px] text-secondary">{business.cashNote}</p>
      </Card>

      <Card className="p-6">
        <p className="text-[12px] text-secondary">Product analysis</p>
        <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">{business.financeStory.title}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-secondary">Why it is performing</p>
            <ul className="mt-2 space-y-2 text-sm">
              {business.financeStory.why.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-secondary">Recommended next actions</p>
            <ul className="mt-2 space-y-2 text-sm">
              {business.financeStory.next.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <SectionHeader title="Ask a finance question" />
        <div className="mt-3 flex flex-wrap gap-2">
          {financeQuestions.map((question) => (
            <Button key={question} variant="secondary" onClick={() => openWith(question)}>
              {question}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SortHead({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <TableHead>
      <button className="font-medium text-secondary hover:text-ink" onClick={onClick}>
        {label}
      </button>
    </TableHead>
  );
}
