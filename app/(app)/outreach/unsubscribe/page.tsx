"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function UnsubscribeForm() {
  const params = useSearchParams();
  const [done, setDone] = useState("");
  return (
    <Card className="mx-auto mt-10 max-w-lg p-6">
      <h1 className="text-xl font-semibold">Stop these emails</h1>
      <p className="mt-2 text-sm text-secondary">This confirms the opt-out. Opening the page does not change anything.</p>
      <Button
        className="mt-4"
        onClick={() => {
          void fetch("/api/outreach", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workspace: "aangan", action: "unsubscribe", input: { leadId: params.get("lead"), token: params.get("token") } }),
          })
            .then((response) => response.json())
            .then((body) => setDone(body.ok ? "You are opted out." : "This link could not be confirmed."));
        }}
      >
        Confirm opt-out
      </Button>
      {done ? <p className="mt-3 text-sm">{done}</p> : null}
    </Card>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeForm />
    </Suspense>
  );
}
