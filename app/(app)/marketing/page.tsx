"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, Minus, Star } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BrainMark } from "@/components/shared/brain-mark";
import { IllustrativeNote } from "@/components/shared/illustrative-note";
import { PastelEventBlock } from "@/components/shared/pastel-event-block";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusChip } from "@/components/shared/status-chip";
import { chartTooltip } from "@/components/shared/tones";
import { useReady } from "@/components/shared/use-ready";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useBusiness } from "@/lib/business-context";
import { record } from "@/lib/record";
import { cn } from "@/lib/utils";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MarketingPage() {
  const { business } = useBusiness();
  const ready = useReady();
  const [published, setPublished] = useState<Record<string, boolean>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [sentReply, setSentReply] = useState<Record<string, boolean>>({});
  const [idea, setIdea] = useState(business.contentSeed);
  const [postsOn, setPostsOn] = useState(false);
  const [goal, setGoal] = useState(business.campaignDefaults.goal);
  const [budget, setBudget] = useState(business.campaignDefaults.budget);
  const [location, setLocation] = useState(business.campaignDefaults.location);
  const [briefOn, setBriefOn] = useState(false);

  const gbpDone = business.gbp.filter((item) => item.done).length;
  const gbpPct = Math.round((gbpDone / business.gbp.length) * 100);

  const brief = useMemo(
    () => ({
      objective: `Generate ${goal} in ${location} this month for ${business.name.split(",")[0]}.`,
      audience: business.audience,
      split: [
        { label: "Local search and Maps", pct: "40%" },
        { label: "Meta prospecting", pct: "35%" },
        { label: "Retargeting", pct: "15%" },
        { label: "Creative production", pct: "10%" },
      ],
    }),
    [business.audience, business.name, goal, location]
  );

  return (
    <div className="space-y-4">
      <IllustrativeNote />
      <Tabs defaultValue="seo">
        <TabsList>
          <TabsTrigger value="seo">Local SEO</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="aeo">AEO</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="campaign">Campaign planner</TabsTrigger>
          <TabsTrigger value="ads">Ads performance</TabsTrigger>
        </TabsList>

        <TabsContent value="seo" className="space-y-4">
          {!ready ? (
            <Card className="p-6">
              <ListSkeleton rows={6} />
            </Card>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <Card className="flex flex-col items-center p-6">
                  <ScoreRing score={business.seoScore} />
                  <p className="mt-2 text-center text-sm text-secondary">SEO health for {business.city}</p>
                </Card>
                <Card className="p-6">
                  <SectionHeader
                    title="Google Business Profile"
                    description={`${gbpDone} of ${business.gbp.length} complete`}
                  />
                  <Progress value={gbpPct} className="mt-4" />
                  <ul className="mt-4 space-y-2">
                    {business.gbp.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border",
                            item.done ? "border-chip-mint-border bg-chip-mint text-chip-mint-ink" : "border-line text-muted"
                          )}
                        >
                          {item.done ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className={item.done ? "text-ink" : "text-secondary"}>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <Card className="p-6">
                <SectionHeader title="Local rankings" description="Position and movement versus last week." />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead>Monthly searches</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {business.rankings.map((row) => (
                      <TableRow key={row.keyword}>
                        <TableCell className="font-medium">{row.keyword}</TableCell>
                        <TableCell className="tabular-nums">{row.position}</TableCell>
                        <TableCell>
                          {row.change > 0 ? (
                            <span className="inline-flex items-center gap-1 text-chip-mint-ink">
                              <ArrowUpRight className="h-4 w-4" aria-hidden /> {row.change}
                            </span>
                          ) : row.change < 0 ? (
                            <span className="inline-flex items-center gap-1 text-chip-rose-ink">
                              <ArrowDownRight className="h-4 w-4" aria-hidden /> {Math.abs(row.change)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-secondary">
                              <Minus className="h-4 w-4" aria-hidden /> Flat
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">{row.volume}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 text-[12px] text-secondary">Rankings are not guaranteed.</p>
              </Card>

              <Card className="p-6">
                <SectionHeader title="Search performance" description="Clicks and impressions, Search Console style." />
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={business.searchSeries}>
                      <CartesianGrid stroke="#E7EBF5" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="clicks" tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="impr" orientation="right" tick={{ fill: "#5A6274", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={chartTooltip} />
                      <Legend />
                      <Line yAxisId="clicks" type="monotone" dataKey="clicks" stroke="#3D6EE0" strokeWidth={2} dot={false} />
                      <Line yAxisId="impr" type="monotone" dataKey="impressions" stroke="#8FA9F3" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="space-y-3">
                <SectionHeader title="Proposed SEO improvements" description="Each fix is a draft until you approve it." />
                {business.seoFixes.map((fix) => (
                  <Card key={fix.id} className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <BrainMark />
                        <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.02em]">{fix.page}</h3>
                        <p className="mt-1 text-sm text-secondary">{fix.issue}</p>
                      </div>
                      {published[fix.id] ? <StatusChip tone="sand">Draft saved</StatusChip> : <StatusChip tone="sand">Pending</StatusChip>}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <MetaPreview label="Before" title={fix.beforeTitle} description={fix.beforeDescription} />
                      <MetaPreview label="After" title={fix.afterTitle} description={fix.afterDescription} accent />
                    </div>
                    <Button
                      className="mt-4"
                      disabled={!!published[fix.id]}
                      onClick={() => {
                        setPublished((current) => ({ ...current, [fix.id]: true }));
                        record(business.id, "seo.draft", fix.page);
                        toast({ title: "Draft saved", description: "The page was not published." });
                      }}
                    >
                      Save draft
                    </Button>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="reviews">
          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <Card className="p-6">
              <SectionHeader title="Scan to review us on Google" />
              <QrPreview />
              <p className="mt-3 text-[12px] text-secondary">A decorative preview, not a live code.</p>
            </Card>
            <div className="space-y-3">
              {business.reviews.map((review) => (
                <Card key={review.id} className={cn("p-5", review.negative && "border-chip-rose-border")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{review.author}</p>
                      <p className="text-[12px] text-secondary">{review.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {review.negative ? <StatusChip tone="rose">Needs attention</StatusChip> : null}
                      <Stars rating={review.rating} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm">{review.text}</p>
                  <div className="mt-3">
                    <BrainMark label="AI-drafted reply" />
                    <Textarea
                      className="mt-2"
                      value={replies[review.id] ?? review.reply}
                      onChange={(event) => setReplies((current) => ({ ...current, [review.id]: event.target.value }))}
                      aria-label={`Reply to ${review.author}`}
                    />
                    <Button
                      className="mt-2"
                      size="sm"
                      disabled={!!sentReply[review.id]}
                      onClick={() => {
                        setSentReply((current) => ({ ...current, [review.id]: true }));
                        record(business.id, "review.draft", review.author);
                        toast({ title: "Reply saved", description: "It was not posted to Google." });
                      }}
                    >
                      {sentReply[review.id] ? "Saved" : "Save reply"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="aeo" className="space-y-3">
          <SectionHeader
            title="Questions people ask assistants"
            description="Whether this business is mentioned, and the content that would help."
          />
          {business.aeo.map((item) => (
            <Card key={item.question} className="p-5 hover:shadow-cardHover">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em]">{item.question}</h3>
                <StatusChip tone={item.mentioned ? "mint" : "sand"}>{item.mentioned ? "Mentioned" : "Not mentioned"}</StatusChip>
              </div>
              <p className="mt-3 text-sm text-secondary">
                <BrainMark /> <span className="ml-2">{item.suggestion}</span>
              </p>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card className="p-6">
            <SectionHeader title="Start from an idea" description="Generate fills four network previews from the sample copy." />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input value={idea} onChange={(event) => setIdea(event.target.value)} aria-label="Content idea" />
              <Button
                onClick={() => {
                  setPostsOn(true);
                  record(business.id, "content.preview", idea || business.contentSeed);
                  toast({ title: "Previews ready", description: "These drafts are on this screen. Nothing was posted." });
                }}
              >
                Generate
              </Button>
            </div>
          </Card>
          {postsOn ? (
            <div className="grid gap-3 md:grid-cols-2">
              {business.posts.map((post) => (
                <Card key={post.network} className="p-5">
                  <StatusChip tone="lavender">{post.network}</StatusChip>
                  <p className="mt-3 text-sm leading-relaxed">{post.caption}</p>
                  <p className="mt-3 text-[12px] text-secondary">Idea: {idea}</p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6">
              <p className="text-sm text-secondary">Previews appear here after you generate.</p>
            </Card>
          )}
          <Card className="p-6">
            <SectionHeader title="This week" description="Content calendar" />
            <div className="mt-4 grid gap-2 md:grid-cols-7">
              {days.map((day, index) => (
                <div key={day} className="min-h-[140px] rounded-inner border border-line bg-white p-2">
                  <p className="mb-2 text-[12px] font-medium text-secondary">{day}</p>
                  <div className="space-y-2">
                    {business.week
                      .filter((event) => event.day === index)
                      .map((event) => (
                        <PastelEventBlock key={event.id} title={event.title} time={event.time} tone={event.tone} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="campaign" className="space-y-4">
          <Card className="p-6">
            <SectionHeader title="Plan a campaign" />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Field label="Goal" value={goal} onChange={setGoal} />
              <Field label="Budget" value={budget} onChange={setBudget} />
              <Field label="Location" value={location} onChange={setLocation} />
            </div>
            <Button className="mt-4" onClick={() => setBriefOn(true)}>
              Build brief
            </Button>
          </Card>
          {briefOn ? (
            <Card className="p-6">
              <BrainMark />
              <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.02em]">Campaign brief</h3>
              <p className="mt-2 text-sm text-secondary">Budget on the brief: {budget}</p>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-secondary">Objective</dt>
                  <dd className="mt-1">{brief.objective}</dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Audience</dt>
                  <dd className="mt-1">{brief.audience}</dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Budget split</dt>
                  <dd className="mt-2 grid gap-2 sm:grid-cols-2">
                    {brief.split.map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-inner border border-line px-3 py-2">
                        <span>{row.label}</span>
                        <span className="font-semibold tabular-nums">{row.pct}</span>
                      </div>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Ad copy</dt>
                  <dd className="mt-2 space-y-2">
                    {business.adCopies.map((copy) => (
                      <p key={copy} className="rounded-inner bg-accent-tint/50 px-3 py-2">
                        {copy}
                      </p>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Creative concepts</dt>
                  <dd className="mt-2 grid gap-2 md:grid-cols-3">
                    {business.creatives.map((item) => (
                      <div key={item.name} className="rounded-inner border border-line p-3">
                        <p className="font-medium">{item.name}</p>
                        <p className="mt-1 text-secondary">{item.note}</p>
                      </div>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Follow-up workflow</dt>
                  <dd className="mt-1">Same-day WhatsApp reply, then a second note after two days if there is no answer.</dd>
                </div>
                <div>
                  <dt className="font-medium text-secondary">Measurement plan</dt>
                  <dd className="mt-1">Enquiries, cost per enquiry, and how many become a paying customer within 14 days.</dd>
                </div>
              </dl>
              <Button
                className="mt-5"
                variant="secondary"
                onClick={() => {
                  const text = `${business.name} campaign brief\n\n${business.contentSeed}`;
                  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${business.id}-campaign-brief.txt`;
                  link.click();
                  URL.revokeObjectURL(url);
                  record(business.id, "campaign.brief", "downloaded");
                  toast({ title: "Brief downloaded", description: "This is the draft on screen, not a published campaign." });
                }}
              >
                Download campaign brief
              </Button>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="ads" className="space-y-4">
          <p className="text-sm text-secondary">Imported data, Meta Ads connection coming later.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Spend", business.adKpis.spend],
              ["Reach", business.adKpis.reach],
              ["Leads", business.adKpis.leads],
              ["Cost per lead", business.adKpis.cpl],
              ["Cost per paying customer", business.adKpis.cpp],
              ["ROI", business.adKpis.roi],
            ].map(([label, value]) => (
              <Card key={label} className="p-5">
                <p className="text-[13px] text-secondary">{label}</p>
                <p className="mt-2 text-[28px] font-semibold tabular-nums tracking-[-0.02em]">{value}</p>
              </Card>
            ))}
          </div>
          <Card className="p-4 md:p-6">
            <SectionHeader title="Campaign comparison" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Spend</TableHead>
                  <TableHead>Reach</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>CPL</TableHead>
                  <TableHead>Cost / customer</TableHead>
                  <TableHead>ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {business.adCampaigns.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.spend}</TableCell>
                    <TableCell>{row.reach}</TableCell>
                    <TableCell>{row.leads}</TableCell>
                    <TableCell>{row.cpl}</TableCell>
                    <TableCell>{row.cpp}</TableCell>
                    <TableCell>{row.roi}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative h-36 w-36" role="img" aria-label={`SEO health ${score} out of 100`}>
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#EEF2FD" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#3D6EE0"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[32px] font-semibold tabular-nums tracking-[-0.02em]">{score}</span>
        <span className="text-[12px] text-secondary">of 100</span>
      </div>
    </div>
  );
}

function MetaPreview({
  label,
  title,
  description,
  accent = false,
}: {
  label: string;
  title: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <div className={cn("rounded-inner border p-3", accent ? "border-chip-blue-border bg-chip-blue" : "border-line bg-[#F8FAFF]")}>
      <p className="text-[12px] font-medium text-secondary">{label}</p>
      <p className="mt-1 text-sm font-semibold text-accent">{title}</p>
      <p className="mt-1 text-[13px] text-secondary">{description}</p>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={cn("h-4 w-4", index < rating ? "fill-[#DCC59B] text-[#6B5226]" : "text-line")} />
      ))}
    </span>
  );
}

function QrPreview() {
  const cells = Array.from({ length: 121 }, (_, index) => {
    const x = index % 11;
    const y = Math.floor(index / 11);
    const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    return finder || (x * 3 + y * 5) % 4 === 0;
  });
  return (
    <div className="mx-auto mt-4 grid w-fit grid-cols-11 gap-0.5 rounded-inner border border-line p-2" aria-hidden>
      {cells.map((on, index) => (
        <span key={index} className={cn("h-2.5 w-2.5", on ? "bg-ink" : "bg-white")} />
      ))}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-[13px] text-secondary">
      {label}
      <Input className="mt-1" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
    </label>
  );
}
