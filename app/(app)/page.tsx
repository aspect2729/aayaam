"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, Filter, LayoutGrid, Star } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAskBrain } from "@/lib/ask-brain";
import { useBusiness } from "@/lib/business-context";
import { record } from "@/lib/record";
import { cn } from "@/lib/utils";

const barShades = ["#EDE7FF", "#E4DCFF", "#D5C8FF", "#C4B2FF", "#A78BFA", "#6D4AFF"];
const donutShades = ["#D9CCFF", "#6D4AFF", "#B7A4FF", "#EDE7FF"];

export default function OverviewPage() {
  const { business } = useBusiness();
  const { openWith } = useAskBrain();
  const [range, setRange] = useState("This Month");
  const revenue = business.financeKpis[0];
  const expenses = business.financeKpis[1];
  const enquiries = business.kpis.find((item) => item.id === "enq") ?? business.kpis[1];
  const activeCustomers = business.customers.filter((customer) => customer.segment !== "Inactive").length;
  const reviewAvg =
    business.reviews.reduce((sum, review) => sum + review.rating, 0) / Math.max(business.reviews.length, 1);
  const expenseTotal = business.expenses.reduce((sum, item) => sum + item.value, 0);

  useEffect(() => {
    if (window.location.hash !== "#brain") return;
    const timer = window.setTimeout(() => {
      document.getElementById("brain")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 280);
    return () => window.clearTimeout(timer);
  }, []);
  const bars = useMemo(() => {
    const months = business.months.map((month) => ({ month: month.month.slice(0, 3), revenue: month.revenue }));
    if (range === "This quarter") return months.slice(-3);
    return months.slice(-1);
  }, [business.months, range]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Business Overview</h1>
          <p className="mt-1 text-[13px] text-secondary">
            Overview <span className="px-1 text-muted">›</span> All Reports
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Range</span>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="h-9 appearance-none rounded-full border border-transparent bg-white pl-3 pr-8 text-[13px] font-medium shadow-card"
              aria-label="Date range"
            >
              <option>This Month</option>
              <option>Last 30 days</option>
              <option>This quarter</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-secondary" aria-hidden />
          </label>
          <button
            className="h-9 rounded-full bg-white px-3 text-[13px] font-medium shadow-card transition-transform duration-200 hover:-translate-y-0.5"
            onClick={() => {
              const csv = ["month,revenue", ...business.months.map((month) => `${month.month},${month.revenue}`)].join("\n");
              const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              const link = document.createElement("a");
              link.href = url;
              link.download = `${business.id}-revenue.csv`;
              link.click();
              URL.revokeObjectURL(url);
              record(business.id, "export.revenue", range);
              toast({ title: "Export downloaded", description: "The revenue file is the demo figures on this screen." });
            }}
          >
            Export
          </button>
          <button
            className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-3 text-[13px] font-medium shadow-card transition-transform duration-200 hover:-translate-y-0.5"
            onClick={() => {
              record(business.id, "filter.range", range);
              toast({ title: "Filter applied", description: `The chart is showing ${range.toLowerCase()} for ${business.city}.` });
            }}
          >
            <Filter className="h-3.5 w-3.5" aria-hidden /> Filter
          </button>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card" aria-hidden>
            <LayoutGrid className="h-4 w-4 text-secondary" />
          </span>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <article className="rounded-[24px] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-[15px] font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3EEFF] text-accent">₹</span>
              Revenue Overview
            </p>
            <span className="rounded-full bg-[#F6F7FB] px-3 py-1 text-[12px] text-secondary">Weekly</span>
          </div>
          <p className="mt-4 text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{revenue?.value}</p>
          {revenue?.delta ? (
            <p className="mt-2 text-[13px] font-medium text-[#12B76A]">↑ {revenue.delta} vs last month</p>
          ) : null}
          <div className="mt-6 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} barCategoryGap="38%">
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#8A93A6", fontSize: 12 }} />
                <YAxis hide />
                <Bar dataKey="revenue" radius={[8, 8, 8, 8]}>
                  {bars.map((bar, index) => (
                    <Cell key={bar.month} fill={barShades[Math.min(index, barShades.length - 1)]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article id="brain" className="relative overflow-hidden rounded-[24px] bg-[#1B1430] p-5 text-white shadow-card">
          <div className="absolute -right-8 top-6 h-40 w-40 rounded-full bg-[#6D4AFF]" aria-hidden />
          <div className="absolute -right-2 top-16 h-28 w-28 rounded-full bg-[#8B6CFF]/80" aria-hidden />
          <p className="relative text-[11px] font-medium tracking-[0.16em] text-white/70">BUSINESS BRAIN</p>
          <h2 className="relative mt-3 max-w-[220px] text-[26px] font-semibold leading-tight tracking-[-0.03em]">
            Your AI business co-pilot
          </h2>
          <p className="relative mt-2 max-w-[240px] text-[13px] leading-5 text-white/75">
            Find opportunities, automate workflows and grow your business.
          </p>
          <div className="relative mt-5 flex flex-wrap items-center gap-2">
            <Button className="rounded-full" onClick={() => openWith("Why are my sales declining?")}>
              Explore Insights <ArrowUpRight className="h-4 w-4" />
            </Button>
            <span className="rounded-full bg-[#D1FADF] px-2 py-1 text-[12px] font-semibold text-[#067647]">
              +{revenue?.delta ?? "15%"}
            </span>
            <span className="text-[12px] text-white/70">productivity this month</span>
          </div>
        </article>

        <article className="rounded-[24px] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold">Leads & Customers</p>
            <span className="rounded-full bg-[#F6F7FB] px-3 py-1 text-[12px] text-secondary">Last 30 days</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat value={enquiries?.value ?? "0"} label="New Enquiries" delta={enquiries?.delta} />
            <Stat value={String(activeCustomers + 300)} label="Active Customers" delta="12%" />
            <div>
              <p className="text-[32px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{reviewAvg.toFixed(1)}</p>
              <p className="mt-2 text-[12px] text-secondary">Google Reviews</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-[#12B76A]">
                <Star className="h-3 w-3 fill-[#F5B942] text-[#F5B942]" aria-hidden /> +{business.reviews.length} new
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[24px] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold">Today&apos;s Schedule</p>
            <Link href="/operations" className="text-[13px] font-medium text-accent">
              See all →
            </Link>
          </div>
          <ol className="relative mt-4 space-y-4 border-l border-[#EEEAF8] pl-4">
            {business.events.slice(0, 3).map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
                <p className="text-[12px] font-semibold text-accent">{event.start}</p>
                <p className="text-[14px] font-medium">{event.title}</p>
                <p className="text-[12px] text-secondary">{event.detail}</p>
              </li>
            ))}
          </ol>
        </article>

        <article className="rounded-[24px] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold">Expense Breakdown</p>
            <span className="rounded-full bg-[#F6F7FB] px-3 py-1 text-[12px] text-secondary">This Month</span>
          </div>
          <p className="mt-3 text-[32px] font-semibold tracking-[-0.04em] tabular-nums">{expenses?.value}</p>
          {expenses?.delta ? <p className="text-[13px] font-medium text-[#F04438]">↑ {expenses.delta} vs last month</p> : null}
          <div className="mt-4 flex items-center gap-4">
            <ul className="flex-1 space-y-2 text-[13px]">
              {business.expenses.slice(0, 4).map((item, index) => (
                <li key={item.name} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-secondary">
                    <span className="h-2 w-2 rounded-full" style={{ background: donutShades[index % donutShades.length] }} />
                    {item.name}
                  </span>
                  <span className="tabular-nums">{Math.round((item.value / expenseTotal) * 100)}%</span>
                </li>
              ))}
            </ul>
            <div
              className="grid h-28 w-28 place-items-center rounded-full"
              style={{
                background: `conic-gradient(#6D4AFF 0 32%, #C4B5FD 32% 56%, #DDD6FE 56% 74%, #EDE9FE 74% 100%)`,
              }}
              aria-hidden
            >
              <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white text-center">
                <span>
                  <span className="block text-[13px] font-semibold leading-4">{compact(expenseTotal)}</span>
                  <span className="text-[10px] text-secondary">Total</span>
                </span>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-[24px] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold">Inventory Status</p>
            <Link href="/commerce" className="text-[13px] font-medium text-accent">
              View all →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {business.products.slice(0, 3).map((product, index) => {
              const low = product.stock <= 8 || product.costMissing;
              return (
                <li
                  key={product.id}
                  className={cn(
                    "flex items-center justify-between rounded-2xl px-3 py-3 transition-transform duration-200 hover:translate-x-0.5",
                    low ? "bg-[#FDECEC]" : index === 1 ? "bg-[#E8F8EF]" : "bg-[#E7F7F4]"
                  )}
                >
                  <span>
                    <span className="block text-[14px] font-medium">{product.name}</span>
                    <span className="text-[12px] text-secondary">
                      {low ? `Low stock · ${product.stock} left` : `In stock · ${product.stock} units`}
                    </span>
                  </span>
                  <span className="text-secondary" aria-hidden>
                    ›
                  </span>
                </li>
              );
            })}
          </ul>
        </article>
      </div>
    </div>
  );
}

function Stat({ value, label, delta }: { value: string; label: string; delta?: string }) {
  return (
    <div>
      <p className="text-[32px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{value}</p>
      <p className="mt-2 text-[12px] text-secondary">{label}</p>
      {delta ? <p className="mt-1 text-[12px] font-medium text-[#12B76A]">↑ {delta}</p> : null}
    </div>
  );
}

function compact(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  return `₹${Math.round(value / 1000)}k`;
}
