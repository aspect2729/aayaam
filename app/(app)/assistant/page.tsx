"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useBusiness } from "@/lib/business-context";
import { record } from "@/lib/record";
import { useActiveConfig } from "@/lib/workspace/active";
import type { WorkspaceConfig } from "@/lib/workspace/catalog";
import { archetypeToBusinessType } from "@/lib/workspace/configure";

type Turn = { reply: string; question: string | null; config: WorkspaceConfig; changes: string[]; model: string };

export default function AssistantPage() {
  const { business, setBusinessType } = useBusiness();
  const { apply, undo } = useActiveConfig();
  const [text, setText] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, displayName: business.name }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      toast({ title: "Not saved", description: body.error?.message ?? "The description was too short." });
      return;
    }
    setTurn(body);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="p-5">
        <p className="text-[13px] text-secondary">Tell me about the business in your own words. The preview stays labelled preview until you apply it.</p>
        <Textarea className="mt-3 min-h-28" value={text} onChange={(event) => setText(event.target.value)} placeholder="What you do, where, who the customers are, and what is hardest to manage." aria-label="Business description" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="rounded-full" disabled={busy} onClick={() => void send()}>
            {busy ? "Reading…" : "Build preview"}
          </Button>
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={() => {
              const restored = undo();
              toast({ title: restored ? "Previous setup restored" : "Nothing to undo", description: "No outside system was changed." });
            }}
          >
            Undo
          </Button>
        </div>
        {turn ? <p className="mt-4 text-sm leading-6">{turn.reply}</p> : null}
        {turn?.question ? <p className="mt-2 text-sm text-secondary">{turn.question}</p> : null}
        {turn ? <p className="mt-3 text-[12px] text-secondary">Wording source: {turn.model === "rules" ? "Rules. No model was called." : turn.model}</p> : null}
      </Card>
      <Card className="p-5">
        <p className="text-[12px] font-semibold tracking-[0.14em] text-muted">PREVIEW</p>
        {turn ? (
          <>
            <ul className="mt-3 space-y-2 text-sm">
              {turn.config.modules.filter((item) => ["leads", "customers", "orders", "projects", "appointments", "memberships"].includes(item.key)).map((item) => (
                <li key={item.key}>{item.navLabel}</li>
              ))}
            </ul>
            <ul className="mt-4 list-disc space-y-1 pl-4 text-[13px] text-secondary">
              {turn.changes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <Button
              className="mt-4 rounded-full"
              onClick={() => {
                apply(turn.config);
                setBusinessType(archetypeToBusinessType(turn.config.archetype));
                record(business.id, "workspace.config_applied", turn.config.archetype);
                toast({ title: "Setup applied", description: "Labels follow this description. Undo is on this page. No message was sent." });
              }}
            >
              Apply
            </Button>
          </>
        ) : (
          <p className="mt-3 text-sm text-secondary">The preview appears after a description. Sample numbers on the other pages stay marked demo.</p>
        )}
      </Card>
    </div>
  );
}
