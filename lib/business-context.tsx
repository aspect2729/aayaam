"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { businesses } from "@/lib/mock-data";
import { record } from "@/lib/record";
import type { BusinessId, BusinessProfile, BusinessType, LeadStage } from "@/lib/types";

type ExtraTask = { id: string; title: string };

type BusinessContextValue = {
  business: BusinessProfile;
  businessId: BusinessId;
  setBusinessId: (id: BusinessId) => void;
  businesses: BusinessProfile[];
  extraTasks: ExtraTask[];
  addTask: (title: string) => void;
  setLeadStage: (leadId: string, stage: LeadStage) => void;
  setBusinessType: (type: BusinessType) => void;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [businessId, setBusinessIdState] = useState<BusinessId>("shakti");
  const [extraTasks, setExtraTasks] = useState<ExtraTask[]>([]);
  const [typeOverride, setTypeOverride] = useState<Partial<Record<BusinessId, BusinessType>>>({});
  const [stageOverride, setStageOverride] = useState<Record<string, LeadStage>>({});

  useEffect(() => {
    const saved = window.localStorage.getItem("aayaam-business");
    if (saved === "shakti" || saved === "mitti" || saved === "aangan") {
      setBusinessIdState(saved);
    }
  }, []);

  const setBusinessId = (id: BusinessId) => {
    setBusinessIdState(id);
    setExtraTasks([]);
    window.localStorage.setItem("aayaam-business", id);
  };

  const business = useMemo(() => {
    const base = businesses.find((item) => item.id === businessId) ?? businesses[0];
    return {
      ...base,
      type: typeOverride[base.id] ?? base.type,
      leads: base.leads.map((lead) => (stageOverride[lead.id] ? { ...lead, stage: stageOverride[lead.id] } : lead)),
    };
  }, [businessId, stageOverride, typeOverride]);

  const addTask = (title: string) => {
    setExtraTasks((current) => [{ id: `task-${Date.now()}`, title }, ...current]);
    record(businessId, "task.create", title);
  };

  const setLeadStage = (leadId: string, stage: LeadStage) => {
    setStageOverride((current) => ({ ...current, [leadId]: stage }));
    record(businessId, "lead.stage", `${leadId} → ${stage}`);
  };

  const setBusinessType = (type: BusinessType) => {
    setTypeOverride((current) => ({ ...current, [businessId]: type }));
    record(businessId, "business.type", type);
  };

  return (
    <BusinessContext.Provider value={{ business, businessId, setBusinessId, businesses, extraTasks, addTask, setLeadStage, setBusinessType }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const value = useContext(BusinessContext);
  if (!value) throw new Error("useBusiness must be used within BusinessProvider");
  return value;
}
