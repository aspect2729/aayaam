"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/lib/workspace-context";

export function useAct() {
  const workspace = useWorkspace();
  const act = async (action: string, input: Record<string, unknown>) => {
    try {
      const result = await workspace.act(action, input);
      toast({ title: "Saved", description: "The business record was updated." });
      return result;
    } catch (error) {
      toast({ title: "Not saved", description: error instanceof Error ? error.message : "The action failed" });
      return null;
    }
  };
  return { ...workspace, act };
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] bg-white p-5 shadow-card">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-[13px]">
      <span className="mb-1 block text-secondary">{label}</span>
      <Input value={value} type={type} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function Submit({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button className="rounded-full" onClick={onClick}>
      {children}
    </Button>
  );
}

export function useFields<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial);
  const set = (key: keyof T) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  return { values, set, reset: () => setValues(initial) };
}
