"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { findAnswer } from "@/lib/mock-data";
import { useBusiness } from "@/lib/business-context";
import type { BrainAnswer } from "@/lib/types";

export type BrainMessage = {
  id: string;
  role: "user" | "brain";
  text: string;
  answer?: BrainAnswer;
};

type AskBrainValue = {
  open: boolean;
  messages: BrainMessage[];
  draft: string;
  setDraft: (value: string) => void;
  openWith: (question?: string) => void;
  setOpen: (open: boolean) => void;
  send: (question?: string) => void;
};

const AskBrainContext = createContext<AskBrainValue | null>(null);

export function AskBrainProvider({ children }: { children: React.ReactNode }) {
  const { business } = useBusiness();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<{ businessId: string; messages: BrainMessage[] } | null>(null);

  const messages = useMemo(() => {
    if (thread && thread.businessId === business.id) return thread.messages;
    return buildExchange(business, "Why are my sales declining?");
  }, [thread, business]);

  const setMessages = (next: BrainMessage[]) => {
    setThread({ businessId: business.id, messages: next });
  };

  const send = (question?: string) => {
    const text = (question ?? draft).trim();
    if (!text) return;
    const answer = findAnswer(business, text);
    setMessages([
      ...messages,
      { id: `u-${Date.now()}`, role: "user", text },
      { id: `b-${Date.now()}`, role: "brain", text, answer },
    ]);
    setDraft("");
    setOpen(true);
  };

  const openWith = (question?: string) => {
    if (question) {
      setMessages(buildExchange(business, question));
      setDraft("");
    }
    setOpen(true);
  };

  return (
    <AskBrainContext.Provider value={{ open, messages, draft, setDraft, openWith, setOpen, send }}>
      {children}
    </AskBrainContext.Provider>
  );
}

function buildExchange(
  business: Parameters<typeof findAnswer>[0],
  question: string
): BrainMessage[] {
  return [
    { id: `u-${question}`, role: "user", text: question },
    { id: `b-${question}`, role: "brain", text: question, answer: findAnswer(business, question) },
  ];
}

export function useAskBrain() {
  const value = useContext(AskBrainContext);
  if (!value) throw new Error("useAskBrain must be used within AskBrainProvider");
  return value;
}
