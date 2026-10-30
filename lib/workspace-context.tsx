"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Workspace } from "@/lib/contracts";

type WorkspaceValue = {
  data: Workspace | null;
  error: string | null;
  refresh: () => Promise<void>;
  act: (action: string, input?: Record<string, unknown>) => Promise<unknown>;
  switchBusiness: (businessId: string) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const response = await fetch("/api/workspace");
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    const body = await response.json();
    if (!response.ok) {
      setError(body.error?.message ?? "The workspace could not be loaded");
      return;
    }
    setError(null);
    setData(body as Workspace);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const act = async (action: string, input: Record<string, unknown> = {}) => {
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, input }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "The action failed");
    await refresh();
    return body.result as unknown;
  };

  const switchBusiness = async (businessId: string) => {
    const response = await fetch("/api/session/business", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Could not switch business");
    await refresh();
  };

  return <WorkspaceContext.Provider value={{ data, error, refresh, act, switchBusiness }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return value;
}
